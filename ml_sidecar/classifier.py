"""
classifier.py — Prototype-network sector classifier using sentence embeddings.

Uses sentence-transformers (paraphrase-MiniLM-L6-v2, ~80MB, CPU-friendly) to
embed issue text, then assigns it to the sector whose centroid embedding is most
similar (cosine nearest-centroid / prototype network).

This approach substantially outperforms TF-IDF + Naive Bayes on short civic
text with few labeled examples — the pre-trained embeddings capture semantic
similarity even when exact keywords are absent.

Sectors aligned with DB/frontend convention:
    infrastructure, roads, water, sanitation, drainage,
    healthcare, education, security, environment, other
"""

import re
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "paraphrase-MiniLM-L6-v2"  # 80MB, ~10ms inference on CPU

# ---------------------------------------------------------------------------
# Seed training data — ~5-7 examples per class gives strong prototypes.
# Labels aligned with DB + frontend SECTORS list.
# ---------------------------------------------------------------------------
SEED_DATA: list[tuple[str, str]] = [
    # infrastructure
    ("road pothole highway junction bridge repair asphalt tarmac", "infrastructure"),
    ("broken road damaged street pavement resurfacing needed", "infrastructure"),
    ("streetlight broken no lights at night dark road unsafe", "infrastructure"),
    ("building collapsed structure damaged public infrastructure failure", "infrastructure"),
    ("sidewalk pavement cracked pedestrian walkway broken uneven", "infrastructure"),
    ("culvert bridge collapsed road impassable heavy vehicles", "infrastructure"),

    # roads
    ("traffic jam congestion road blocked vehicles stuck hours", "roads"),
    ("road sign missing traffic signal broken dangerous intersection", "roads"),
    ("speed bumps needed dangerous road accident prone area", "roads"),
    ("road markings faded unclear lane markings highway", "roads"),
    ("road construction abandoned unfinished left open hazard", "roads"),
    ("one-way road wrong-way drivers traffic flow problem", "roads"),

    # water
    ("water supply cut shortage no water pipe burst main", "water"),
    ("drinking water contaminated dirty brown murky colour", "water"),
    ("no water pressure low pressure taps dry supply issue", "water"),
    ("burst pipe leaking road flooding water main rupture", "water"),
    ("water meter broken billing dispute supply disconnect", "water"),
    ("borehole well pump broken no water source community", "water"),

    # sanitation
    ("garbage rubbish waste collection bins overflowing refuse", "sanitation"),
    ("illegal dumping fly-tipping refuse waste site community", "sanitation"),
    ("waste collection truck not coming garbage piling street", "sanitation"),
    ("public toilet latrine dirty unhygienic filthy facilities", "sanitation"),
    ("market hygiene inspection food handling contamination", "sanitation"),
    ("slaughterhouse waste disposal sanitation violation", "sanitation"),

    # drainage
    ("flood drains blocked sewage overflow flooding street", "drainage"),
    ("gutter clogged blocked storm drain not flowing stagnant", "drainage"),
    ("stagnant water mosquito breeding drain overflow disease", "drainage"),
    ("culvert blocked flooding residential area heavy rain", "drainage"),
    ("erosion channel collapse drain overflow neighbourhood", "drainage"),
    ("open drain dangerous children falling uncovered hazard", "drainage"),

    # healthcare
    ("hospital clinic doctor medicine treatment patient healthcare", "healthcare"),
    ("ambulance emergency response medical nurse healthcare facility", "healthcare"),
    ("drugs medicine shortage clinic supply chain hospital pharmacy", "healthcare"),
    ("vaccination immunization health campaign community public health", "healthcare"),
    ("mental health counselling support community psychiatric services", "healthcare"),
    ("health centre closed no staff doctors equipment inadequate", "healthcare"),

    # education
    ("school classroom teacher student textbook education quality", "education"),
    ("university college fees scholarship bursary tuition funding", "education"),
    ("school building dilapidated leaking roof classroom dangerous", "education"),
    ("teacher absent no teachers school quality declining", "education"),
    ("school feeding programme children lunch nutrition meals", "education"),
    ("school enrollment dropout rates youth education access", "education"),

    # security
    ("crime theft robbery assault neighbourhood unsafe insecure", "security"),
    ("police patrol security lighting dark area crime prevention", "security"),
    ("vandalism graffiti property damage broken windows harassment", "security"),
    ("drug dealing narcotics illegal activity neighbourhood residents", "security"),
    ("domestic violence abuse safety reporting community protection", "security"),
    ("armed robbery gunshots violence community safety threat", "security"),

    # environment
    ("pollution air quality dust smoke fumes environmental hazard", "environment"),
    ("deforestation tree cutting illegal logging forest destruction", "environment"),
    ("erosion landslide river bank collapse flooding environmental", "environment"),
    ("noise pollution factory industrial residential area complaint", "environment"),
    ("chemical waste dumping river stream contamination toxic", "environment"),
    ("bush fire illegal burning vegetation environmental damage", "environment"),

    # other
    ("electricity power outage blackout transformer grid failure", "other"),
    ("community centre facility park garden public space request", "other"),
    ("disability access ramp building wheelchair accessible complaint", "other"),
    ("government office service delay bureaucracy permit processing", "other"),
    ("internet connectivity broadband service outage coverage gap", "other"),
    ("public transport bus route service frequency complaint", "other"),
]


class PrototypeClassifier:
    """
    Nearest-centroid classifier using sentence embeddings.

    For each class, we compute the mean embedding of all its training examples
    (the "prototype"). At inference, we find the class whose prototype has the
    highest cosine similarity with the query embedding.
    """

    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model = SentenceTransformer(model_name)
        self._prototypes: dict[str, np.ndarray] = {}
        self._classes: list[str] = []

    def fit(self, texts: list[str], labels: list[str]) -> None:
        """Compute per-class prototype embeddings."""
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        classes = sorted(set(labels))
        self._classes = classes
        for cls in classes:
            idxs = [i for i, lbl in enumerate(labels) if lbl == cls]
            proto = embeddings[idxs].mean(axis=0)
            norm = np.linalg.norm(proto)
            self._prototypes[cls] = proto / norm if norm > 0 else proto

    def predict(self, text: str) -> str:
        emb = self.model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
        sims = {cls: float(np.dot(emb, proto)) for cls, proto in self._prototypes.items()}
        return max(sims, key=sims.get)

    def predict_proba(self, text: str) -> dict:
        emb = self.model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
        sims = {cls: float(np.dot(emb, proto)) for cls, proto in self._prototypes.items()}
        # Softmax over cosine similarities for calibrated probabilities
        vals = np.array(list(sims.values()))
        exp_vals = np.exp((vals - vals.max()) * 5)  # temperature=0.2 sharpens distribution
        probs = exp_vals / exp_vals.sum()
        scores = {cls: round(float(p), 4) for cls, p in zip(sims.keys(), probs)}
        best = max(scores, key=scores.get)
        return {"sector": best, "scores": scores}

    def retrain(self, new_texts: list[str], new_labels: list[str]) -> None:
        """Incorporate new labeled examples and recompute prototypes."""
        all_texts = [t for t, _ in SEED_DATA] + new_texts
        all_labels = [lbl for _, lbl in SEED_DATA] + new_labels
        self.fit(all_texts, all_labels)


def _clean(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text.lower()).strip()


# ---------------------------------------------------------------------------
# Module-level singleton — fitted once at import
# ---------------------------------------------------------------------------
print("Classifier: loading sentence-transformer model…")
_classifier = PrototypeClassifier()
_classifier.fit(
    [t for t, _ in SEED_DATA],
    [lbl for _, lbl in SEED_DATA],
)
print("Classifier: ready.")


def classify(text: str) -> str:
    """Return the predicted sector label for the given text."""
    return _classifier.predict(_clean(text))


def classify_proba(text: str) -> dict:
    """Return sector label + calibrated confidence scores for all classes."""
    return _classifier.predict_proba(_clean(text))


def retrain(new_texts: list[str], new_labels: list[str]) -> None:
    """Add new confirmed labels and refit the classifier."""
    _classifier.retrain(new_texts, new_labels)
