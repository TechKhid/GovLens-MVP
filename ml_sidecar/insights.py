"""
insights.py — Linear regression trend forecasts over issue submission counts.

Uses a simple OLS regression on daily issue counts to project the next N days.
Outputs a forecast array + slope (positive = worsening trend).
"""

import datetime
from collections import defaultdict


def _linreg(x: list[float], y: list[float]) -> tuple[float, float]:
    """Ordinary Least Squares: returns (slope, intercept)."""
    n = len(x)
    if n < 2:
        return 0.0, (y[0] if y else 0.0)
    sx, sy, sxy, sx2 = sum(x), sum(y), sum(a * b for a, b in zip(x, y)), sum(a ** 2 for a in x)
    slope = (n * sxy - sx * sy) / (n * sx2 - sx ** 2 + 1e-9)
    intercept = (sy - slope * sx) / n
    return round(slope, 4), round(intercept, 4)


def forecast(issues: list[dict], days_ahead: int = 7, zone: str | None = None) -> dict:
    """
    Given a list of issue dicts (each with 'created_at' and optionally 'zone'),
    return a forecast of daily issue counts for the next `days_ahead` days.

    Args:
        issues:     List of issue records from DB (dicts).
        days_ahead: How many future days to forecast.
        zone:       If provided, filter issues to this zone first.

    Returns:
        {
          "slope":      float,          # positive = growing; negative = declining
          "intercept":  float,
          "forecast":   [{"date": str, "predicted_count": float}, ...],
          "trend":      "increasing" | "stable" | "decreasing",
          "historical": [{"date": str, "count": int}, ...]
        }
    """
    if zone:
        issues = [i for i in issues if i.get("zone") == zone]

    # Bucket by date string (YYYY-MM-DD)
    daily: dict[str, int] = defaultdict(int)
    for issue in issues:
        created = issue.get("created_at")
        if created is None:
            continue
        # Handle both datetime objects and ISO strings
        if hasattr(created, "date"):
            date_str = created.date().isoformat()
        else:
            date_str = str(created)[:10]
        daily[date_str] += 1

    sorted_dates = sorted(daily.keys())
    if len(sorted_dates) < 2:
        return {
            "slope": 0.0,
            "intercept": 0.0,
            "forecast": [],
            "trend": "stable",
            "historical": [{"date": d, "count": daily[d]} for d in sorted_dates],
        }

    x = list(range(len(sorted_dates)))
    y = [daily[d] for d in sorted_dates]
    slope, intercept = _linreg(x, y)

    # Generate future dates
    last_date = datetime.date.fromisoformat(sorted_dates[-1])
    forecast_points = []
    for i in range(1, days_ahead + 1):
        future_date = (last_date + datetime.timedelta(days=i)).isoformat()
        predicted = max(0.0, slope * (len(sorted_dates) + i - 1) + intercept)
        forecast_points.append({"date": future_date, "predicted_count": round(predicted, 2)})

    if slope > 0.1:
        trend = "increasing"
    elif slope < -0.1:
        trend = "decreasing"
    else:
        trend = "stable"

    return {
        "slope": slope,
        "intercept": intercept,
        "forecast": forecast_points,
        "trend": trend,
        "historical": [{"date": d, "count": daily[d]} for d in sorted_dates],
    }
