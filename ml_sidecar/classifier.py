"""
classifier.py — TF-IDF + Naive Bayes sector classifier.

Trained on seed examples at startup; updates whenever new labelled data arrives.
Sectors: infrastructure, utilities, healthcare, education, environment, other
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import re

# ---------------------------------------------------------------------------
# Seed training data — deliberately small for MVP; grows with real issues
# ---------------------------------------------------------------------------
SEED_DATA = [
    # (text, label)
    ("road pothole traffic junction highway bridge asphalt repair", "infrastructure"),
    ("broken road damaged street pavement flood drains blocked", "infrastructure"),
    ("water pipe burst supply cut shortage clean drinking", "utilities"),
    ("electricity power outage blackout TNB grid transformer", "utilities"),
    ("sewage drain smell waste blocked pipes sewerage", "utilities"),
    ("hospital clinic doctor medicine health treatment dengue", "healthcare"),
    ("ambulance emergency response medical nurse patient", "healthcare"),
    ("school classroom teacher student education fund textbook", "education"),
    ("university college tuition fees scholarship bursary", "education"),
    ("rubbish garbage dump illegal waste environmental pollution", "environment"),
    ("flood river deforestation erosion landslide drainage", "environment"),
    ("park tree garden public space recreation facility", "environment"),
    ("crime safety police security theft assault neighbourhood", "public_safety"),
    ("noise complaint nuisance neighbour disturbance", "community"),
]

TEXTS  = [t for t, _ in SEED_DATA]
LABELS = [l for _, l in SEED_DATA]

# ---------------------------------------------------------------------------
# Build & fit pipeline
# ---------------------------------------------------------------------------
_pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        stop_words="english",
        sublinear_tf=True,
    )),
    ("clf", MultinomialNB(alpha=0.5)),
])

_pipeline.fit(TEXTS, LABELS)


def classify(text: str) -> str:
    """Return the predicted sector label for the given text."""
    text = re.sub(r"[^\w\s]", " ", text.lower())
    prediction = _pipeline.predict([text])
    return prediction[0]


def classify_proba(text: str) -> dict:
    """Return the sector label + confidence scores."""
    text = re.sub(r"[^\w\s]", " ", text.lower())
    proba = _pipeline.predict_proba([text])[0]
    classes = _pipeline.classes_
    scores = {c: round(float(p), 4) for c, p in zip(classes, proba)}
    best = max(scores, key=scores.get)
    return {"sector": best, "scores": scores}
