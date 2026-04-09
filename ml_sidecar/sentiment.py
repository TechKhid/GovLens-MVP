"""
sentiment.py — Hybrid civic sentiment & urgency analysis.

Combines three signals:
  1. VADER polarity scoring — fast rule-based baseline
  2. Civic urgency lexicon — domain-specific term weights for civic complaints
  3. Semantic anchor scoring — embedding similarity to "urgent" vs "minor" anchors
     (reuses the same sentence-transformer loaded by classifier.py)

The combined urgency score adjusts the VADER compound to produce a severity
label that is appropriate for civic issue text (where VADER under-scores terms
like "pothole", "sewage overflow", "power cut" because they lack sentiment words).

Severity mapping:
    compound < -0.5  OR combined_urgency >= 0.70  → "high"
    compound < 0.0   OR combined_urgency >= 0.40  → "medium"
    otherwise                                      → "low"
"""

from __future__ import annotations

import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sentence_transformers import SentenceTransformer

_vader = SentimentIntensityAnalyzer()

# ---------------------------------------------------------------------------
# Civic urgency lexicon
# Key = term (lowercase substring match), value = urgency weight 0.0–1.0
# ---------------------------------------------------------------------------
CIVIC_URGENCY_LEXICON: dict[str, float] = {
    # Immediate danger
    "emergency": 0.90,
    "collapsed": 0.90,
    "flooding": 0.80,
    "sewage overflow": 0.85,
    "accident": 0.80,
    "dangerous": 0.85,
    "hazardous": 0.85,
    "contaminated": 0.80,
    "burst pipe": 0.75,
    "fire": 0.80,
    "armed robbery": 0.90,
    "violence": 0.80,
    # High
    "no water": 0.70,
    "power outage": 0.65,
    "blackout": 0.60,
    "overflowing": 0.70,
    "blocked drain": 0.65,
    "illegal dumping": 0.60,
    "pothole": 0.45,
    "broken": 0.50,
    "unsafe": 0.65,
    "stagnant water": 0.60,
    "mosquito": 0.55,
    "leaking": 0.45,
    "crime": 0.65,
    "robbery": 0.75,
    # Medium
    "not working": 0.40,
    "cracked": 0.35,
    "delayed": 0.30,
    "shortage": 0.40,
    "congestion": 0.35,
    "abandoned": 0.35,
    # Low / informational
    "request": 0.10,
    "suggestion": 0.05,
    "recommend": 0.05,
}

# ---------------------------------------------------------------------------
# Semantic urgency anchors — averaged embeddings define the urgency poles
# ---------------------------------------------------------------------------
_HIGH_URGENCY_ANCHORS = [
    "this is an emergency that needs immediate attention right now",
    "dangerous condition causing immediate risk to public safety",
    "critical infrastructure failure severely affecting many residents",
    "serious hazard threatening lives and property of the community",
]
_LOW_URGENCY_ANCHORS = [
    "minor inconvenience that can be addressed in due course",
    "small cosmetic issue that does not affect daily life",
    "general feedback or suggestion for long-term improvement",
    "informational request with no immediate urgency",
]

# Lazy-loaded — shared model instance (same as classifier.py via ST cache)
_embed_model: SentenceTransformer | None = None
_high_anchor_emb: np.ndarray | None = None
_low_anchor_emb: np.ndarray | None = None


def _load_anchors() -> tuple[SentenceTransformer, np.ndarray, np.ndarray]:
    global _embed_model, _high_anchor_emb, _low_anchor_emb
    if _embed_model is None:
        _embed_model = SentenceTransformer("paraphrase-MiniLM-L6-v2")
        high_embs = _embed_model.encode(_HIGH_URGENCY_ANCHORS, normalize_embeddings=True, show_progress_bar=False)
        low_embs = _embed_model.encode(_LOW_URGENCY_ANCHORS, normalize_embeddings=True, show_progress_bar=False)
        _high_anchor_emb = high_embs.mean(axis=0)
        _low_anchor_emb = low_embs.mean(axis=0)
    return _embed_model, _high_anchor_emb, _low_anchor_emb  # type: ignore[return-value]


def _lexicon_urgency(text: str) -> float:
    """Return 0.0–1.0 urgency from civic term lexicon (max match)."""
    text_lower = text.lower()
    score = 0.0
    for term, weight in CIVIC_URGENCY_LEXICON.items():
        if term in text_lower:
            score = max(score, weight)
    return score


def _semantic_urgency(text: str) -> float:
    """Return 0.0–1.0 urgency from embedding anchor similarity."""
    model, high_emb, low_emb = _load_anchors()
    emb = model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0]
    high_sim = float(np.dot(emb, high_emb))
    low_sim = float(np.dot(emb, low_emb))
    # Remap cosine similarity difference to [0, 1]
    return max(0.0, min(1.0, (high_sim - low_sim + 1.0) / 2.0))


def analyze(text: str) -> dict:
    """
    Full hybrid sentiment + urgency analysis for a single issue text.

    Returns:
        compound         : float  VADER compound score -1.0→+1.0
        positive/negative/neutral : float  VADER sub-scores
        civic_urgency    : float  lexicon urgency 0.0→1.0
        semantic_urgency : float  embedding anchor urgency 0.0→1.0
        severity         : "low" | "medium" | "high"
    """
    vader_scores = _vader.polarity_scores(text)
    compound = vader_scores["compound"]
    civic_urg = _lexicon_urgency(text)
    sem_urg = _semantic_urgency(text)
    # Weight: lexicon is more precise for known terms; semantic handles unknowns
    combined_urgency = max(civic_urg, sem_urg * 0.75)

    if compound < -0.5 or combined_urgency >= 0.70:
        severity = "high"
    elif compound < 0.0 or combined_urgency >= 0.40:
        severity = "medium"
    else:
        severity = "low"

    return {
        "compound": round(compound, 4),
        "positive": round(vader_scores["pos"], 4),
        "negative": round(vader_scores["neg"], 4),
        "neutral": round(vader_scores["neu"], 4),
        "civic_urgency": round(civic_urg, 4),
        "semantic_urgency": round(sem_urg, 4),
        "severity": severity,
    }


def aggregate(rows: list[dict]) -> dict:
    """
    Aggregate sentiment across a list of issue dicts.
    Each dict must contain at least 'title' and 'description'.
    """
    if not rows:
        return {
            "average_compound": 0.0,
            "severity_distribution": {"low": 0, "medium": 0, "high": 0},
            "overall_severity": "low",
            "sample_size": 0,
        }

    compounds: list[float] = []
    distribution = {"low": 0, "medium": 0, "high": 0}

    for row in rows:
        text = f"{row.get('title', '')}. {row.get('description', '')}"
        result = analyze(text)
        compounds.append(result["compound"])
        distribution[result["severity"]] += 1

    avg = sum(compounds) / len(compounds)
    if avg < -0.5:
        overall = "high"
    elif avg < 0.0:
        overall = "medium"
    else:
        overall = "low"

    return {
        "average_compound": round(avg, 4),
        "severity_distribution": distribution,
        "overall_severity": overall,
        "sample_size": len(rows),
    }


def aggregate_by_sector(rows: list[dict]) -> dict:
    """
    Return per-sector sentiment aggregation.
    Each row must have 'title', 'description', and 'sector'.
    """
    from collections import defaultdict
    by_sector: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        sector = (row.get("sector") or "other").lower()
        by_sector[sector].append(row)

    return {sector: aggregate(sector_rows) for sector, sector_rows in by_sector.items()}
