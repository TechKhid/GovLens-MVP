"""
Sentence-embedding sector classifier with civic keyword priors.

The embedding model provides the semantic baseline, while keyword boosts help
the classifier stay intuitive for common civic phrasing such as:
  - pothole -> roads
  - burst pipe -> water
  - open drain -> drainage

Only sectors supported by the product are returned.
"""

import re

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "paraphrase-MiniLM-L6-v2"

SUPPORTED_SECTORS = [
    "infrastructure",
    "roads",
    "water",
    "sanitation",
    "drainage",
    "education",
    "security",
    "other",
]

SECTOR_ALIASES = {
    "healthcare": "other",
    "environment": "other",
}

SECTOR_KEYWORD_BOOSTS: dict[str, dict[str, float]] = {
    "roads": {
        "pothole": 0.34,
        "potholes": 0.34,
        "road surface": 0.18,
        "asphalt": 0.12,
        "tarmac": 0.12,
        "vehicle damage": 0.20,
        "car damage": 0.18,
        "damaging cars": 0.22,
        "damaging vehicles": 0.22,
        "lane marking": 0.14,
        "traffic": 0.08,
        "junction": 0.08,
    },
    "infrastructure": {
        "streetlight": 0.28,
        "street light": 0.28,
        "bridge": 0.22,
        "sidewalk": 0.16,
        "pavement": 0.12,
        "building": 0.10,
    },
    "water": {
        "burst pipe": 0.34,
        "water pipe": 0.24,
        "water supply": 0.26,
        "no water": 0.24,
        "low pressure": 0.18,
        "drinking water": 0.20,
    },
    "sanitation": {
        "waste bin": 0.26,
        "waste bins": 0.26,
        "garbage": 0.22,
        "refuse": 0.20,
        "rubbish": 0.18,
        "overflowing waste": 0.24,
        "dumping": 0.16,
    },
    "drainage": {
        "open drain": 0.34,
        "drain": 0.16,
        "gutter": 0.18,
        "sewage": 0.24,
        "stagnant water": 0.22,
        "mosquito": 0.14,
        "flooding": 0.14,
    },
    "education": {
        "school": 0.28,
        "classroom": 0.24,
        "teacher": 0.18,
        "student": 0.18,
        "students": 0.18,
        "toilet facility": 0.16,
    },
    "security": {
        "robbery": 0.28,
        "crime": 0.24,
        "theft": 0.22,
        "police": 0.18,
        "unsafe": 0.16,
        "vandalism": 0.18,
    },
    "other": {
        "power outage": 0.28,
        "blackout": 0.24,
        "internet": 0.18,
        "broadband": 0.16,
        "public transport": 0.18,
    },
}

SEED_DATA: list[tuple[str, str]] = [
    # infrastructure
    ("broken road damaged street pavement resurfacing needed", "infrastructure"),
    ("streetlight broken no lights at night dark road unsafe", "infrastructure"),
    ("building collapsed structure damaged public infrastructure failure", "infrastructure"),
    ("sidewalk pavement cracked pedestrian walkway broken uneven", "infrastructure"),
    ("culvert bridge collapsed road impassable heavy vehicles", "infrastructure"),
    ("bridge railing broken and public pavement damaged near junction", "infrastructure"),

    # roads
    ("traffic jam congestion road blocked vehicles stuck hours", "roads"),
    ("road sign missing traffic signal broken dangerous intersection", "roads"),
    ("speed bumps needed dangerous road accident prone area", "roads"),
    ("road markings faded unclear lane markings highway", "roads"),
    ("road construction abandoned unfinished left open hazard", "roads"),
    ("one-way road wrong-way drivers traffic flow problem", "roads"),
    ("massive pothole on main street damaging cars and blocking traffic", "roads"),
    ("deep potholes across road surface causing vehicle damage and congestion", "roads"),

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

    # healthcare -> other
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

    # environment -> other
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
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model = SentenceTransformer(model_name)
        self._prototypes: dict[str, np.ndarray] = {}

    def fit(self, texts: list[str], labels: list[str]) -> None:
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        for cls in sorted(set(labels)):
            idxs = [i for i, label in enumerate(labels) if label == cls]
            proto = embeddings[idxs].mean(axis=0)
            norm = np.linalg.norm(proto)
            self._prototypes[cls] = proto / norm if norm > 0 else proto

    def _score(self, text: str) -> dict[str, float]:
        emb = self.model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
        raw_scores = {cls: float(np.dot(emb, proto)) for cls, proto in self._prototypes.items()}

        aggregated_scores = {sector: -1.0 for sector in SUPPORTED_SECTORS}
        for label, score in raw_scores.items():
            canonical = SECTOR_ALIASES.get(label, label)
            if canonical in aggregated_scores:
                aggregated_scores[canonical] = max(aggregated_scores[canonical], score)

        for sector, keywords in SECTOR_KEYWORD_BOOSTS.items():
            boost = 0.0
            for keyword, weight in keywords.items():
                if keyword in text:
                    boost += weight
            if boost > 0:
                aggregated_scores[sector] += min(boost, 0.45)

        # Flooded potholes should stay in the road-maintenance bucket unless
        # the text also contains explicit drainage infrastructure language.
        if "pothole" in text or "potholes" in text:
            aggregated_scores["roads"] += 0.18
            if not any(term in text for term in ("drain", "gutter", "sewage", "culvert")):
                aggregated_scores["roads"] += 0.08

        return aggregated_scores

    def predict(self, text: str) -> str:
        scores = self._score(text)
        return max(scores, key=scores.get)

    def predict_proba(self, text: str) -> dict:
        scores = self._score(text)
        values = np.array(list(scores.values()))
        exp_vals = np.exp((values - values.max()) * 5)
        probs = exp_vals / exp_vals.sum()
        normalized_scores = {
            sector: round(float(prob), 4)
            for sector, prob in zip(scores.keys(), probs)
        }
        best = max(normalized_scores, key=normalized_scores.get)
        return {"sector": best, "scores": normalized_scores}

    def retrain(self, new_texts: list[str], new_labels: list[str]) -> None:
        all_texts = [text for text, _ in SEED_DATA] + new_texts
        all_labels = [label for _, label in SEED_DATA] + new_labels
        self.fit(all_texts, all_labels)


def _clean(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text.lower()).strip()


print("Classifier: loading sentence-transformer model...")
_classifier = PrototypeClassifier()
_classifier.fit(
    [text for text, _ in SEED_DATA],
    [label for _, label in SEED_DATA],
)
print("Classifier: ready.")


def classify(text: str) -> str:
    return _classifier.predict(_clean(text))


def classify_proba(text: str) -> dict:
    return _classifier.predict_proba(_clean(text))


def retrain(new_texts: list[str], new_labels: list[str]) -> None:
    _classifier.retrain(new_texts, new_labels)
