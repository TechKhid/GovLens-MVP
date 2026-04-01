"""
sentiment.py — VADER-based sentiment analysis helpers.

VADER is a rule-based model optimised for short social-style text (ideal for
citizen issue reports). It scores polarity from -1.0 (very negative) to +1.0
(very positive) and maps compound score to a severity level.

compound < -0.5  → high severity
compound < 0.0   → medium severity
otherwise        → low severity
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_analyzer = SentimentIntensityAnalyzer()


def analyze(text: str) -> dict:
    """
    Return a dict with raw VADER scores and a derived severity label.

    Returns:
        {
          "compound": float,      # -1.0 to +1.0
          "positive": float,
          "negative": float,
          "neutral":  float,
          "severity": "low" | "medium" | "high"
        }
    """
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound < -0.5:
        severity = "high"
    elif compound < 0.0:
        severity = "medium"
    else:
        severity = "low"

    return {
        "compound": round(compound, 4),
        "positive": round(scores["pos"], 4),
        "negative": round(scores["neg"], 4),
        "neutral":  round(scores["neu"], 4),
        "severity": severity,
    }


def aggregate(rows: list[dict]) -> dict:
    """
    Aggregate sentiment scores across a list of issue dicts.
    Each dict must contain at least 'title' and 'description'.

    Returns average compound score, severity distribution, and overall severity.
    """
    if not rows:
        return {
            "average_compound": 0.0,
            "severity_distribution": {"low": 0, "medium": 0, "high": 0},
            "overall_severity": "low",
            "sample_size": 0,
        }

    compounds = []
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
