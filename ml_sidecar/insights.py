"""
insights.py — Time-series forecasting and pattern analysis.

Uses Prophet for trend forecasting (handles weekly seasonality, missing data,
uncertainty intervals). Falls back to OLS linear regression if Prophet is not
available (e.g. during testing without full deps).

Additional helpers:
    top_sectors()         — top N sectors by volume, with % change vs prior period
    recurring_patterns()  — zone × sector pairs with high repeat submission counts
    response_time_trend() — rolling average days-to-resolve over time windows
"""

from __future__ import annotations

import datetime
import logging
from collections import defaultdict
from typing import Optional

from geo_scope import zone_matches_scope
from prophet_runtime import ensure_prophet_cmdstan_path

try:
    import pandas as pd
    ensure_prophet_cmdstan_path()
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------

def forecast(
    issues: list[dict],
    days_ahead: int = 7,
    zone: Optional[str] = None,
) -> dict:
    """
    Forecast daily issue submission counts for the next `days_ahead` days.

    Args:
        issues:     Issue records from DB — must contain 'created_at', optionally 'zone'.
        days_ahead: Horizon (1–30 days).
        zone:       Optional constituency filter.

    Returns dict with keys: slope, intercept, forecast, trend, historical, model.
    Each forecast point includes lower/upper uncertainty bounds.
    """
    if zone:
        issues = [i for i in issues if zone_matches_scope(i.get("zone"), zone)]

    daily: dict[str, int] = defaultdict(int)
    for issue in issues:
        created = issue.get("created_at")
        if created is None:
            continue
        date_str = created.date().isoformat() if hasattr(created, "date") else str(created)[:10]
        daily[date_str] += 1

    sorted_dates = sorted(daily.keys())
    historical = [{"date": d, "count": daily[d]} for d in sorted_dates]

    if len(sorted_dates) < 2:
        return {
            "slope": 0.0, "intercept": 0.0,
            "forecast": [], "trend": "stable",
            "historical": historical, "model": "insufficient_data",
        }

    if HAS_PROPHET and len(sorted_dates) >= 7:
        try:
            return _prophet_forecast(sorted_dates, daily, days_ahead, historical)
        except Exception as exc:
            logger.warning("Prophet forecast failed; falling back to OLS: %s", exc)
    return _ols_forecast(sorted_dates, daily, days_ahead, historical)


def _prophet_forecast(sorted_dates, daily, days_ahead, historical) -> dict:
    ensure_prophet_cmdstan_path()
    df = pd.DataFrame({
        "ds": pd.to_datetime(sorted_dates),
        "y": [float(daily[d]) for d in sorted_dates],
    })
    m = Prophet(
        stan_backend="CMDSTANPY",
        weekly_seasonality=True,
        yearly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,  # conservative — MVP has limited history
        interval_width=0.80,
    )
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m.fit(df)

    future = m.make_future_dataframe(periods=days_ahead)
    pred = m.predict(future)
    forecast_rows = pred.tail(days_ahead)

    forecast_points = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted_count": round(max(0.0, row["yhat"]), 2),
            "lower": round(max(0.0, row["yhat_lower"]), 2),
            "upper": round(max(0.0, row["yhat_upper"]), 2),
        }
        for _, row in forecast_rows.iterrows()
    ]

    # Slope from Prophet trend component (units: issues/day)
    slope = round(
        (float(pred.iloc[-1]["trend"]) - float(pred.iloc[-days_ahead - 1]["trend"])) / days_ahead, 4
    )
    trend = "increasing" if slope > 0.1 else ("decreasing" if slope < -0.1 else "stable")

    return {
        "slope": slope, "intercept": 0.0,
        "forecast": forecast_points, "trend": trend,
        "historical": historical, "model": "prophet",
    }


def _ols_forecast(sorted_dates, daily, days_ahead, historical) -> dict:
    """Fallback OLS regression."""
    x = list(range(len(sorted_dates)))
    y = [daily[d] for d in sorted_dates]
    n = len(x)
    sx, sy = sum(x), sum(y)
    sxy = sum(a * b for a, b in zip(x, y))
    sx2 = sum(a ** 2 for a in x)
    slope = round((n * sxy - sx * sy) / (n * sx2 - sx ** 2 + 1e-9), 4)
    intercept = round((sy - slope * sx) / n, 4)

    last_date = datetime.date.fromisoformat(sorted_dates[-1])
    forecast_points = []
    for i in range(1, days_ahead + 1):
        predicted = max(0.0, slope * (len(sorted_dates) + i - 1) + intercept)
        forecast_points.append({
            "date": (last_date + datetime.timedelta(days=i)).isoformat(),
            "predicted_count": round(predicted, 2),
            "lower": round(max(0.0, predicted * 0.7), 2),
            "upper": round(predicted * 1.3, 2),
        })

    trend = "increasing" if slope > 0.1 else ("decreasing" if slope < -0.1 else "stable")
    return {
        "slope": slope, "intercept": intercept,
        "forecast": forecast_points, "trend": trend,
        "historical": historical, "model": "ols",
    }


# ---------------------------------------------------------------------------
# Top sectors (with period-over-period change)
# ---------------------------------------------------------------------------

def top_sectors(
    issues: list[dict],
    n: int = 5,
    zone: Optional[str] = None,
) -> list[dict]:
    """
    Return the top N sectors by issue count, with % change vs. the prior
    equivalent time window (split issues list in half by submission time).

    Each result: { sector, count, prior_count, pct_change, trending }
    """
    if zone:
        issues = [i for i in issues if zone_matches_scope(i.get("zone"), zone)]
    if not issues:
        return []

    sorted_issues = sorted(issues, key=lambda i: str(i.get("created_at", "")))
    mid = len(sorted_issues) // 2
    current_issues = sorted_issues[mid:]
    prior_issues = sorted_issues[:mid]

    def _count(batch: list[dict]) -> dict[str, int]:
        counts: dict[str, int] = defaultdict(int)
        for iss in batch:
            counts[(iss.get("sector") or "other").lower()] += 1
        return dict(counts)

    curr = _count(current_issues)
    prev = _count(prior_issues)

    results = []
    for sector, count in sorted(curr.items(), key=lambda x: -x[1])[:n]:
        prior = prev.get(sector, 0)
        pct = round(((count - prior) / max(prior, 1)) * 100, 1)
        results.append({
            "sector": sector,
            "count": count,
            "prior_count": prior,
            "pct_change": pct,
            "trending": "up" if pct > 10 else ("down" if pct < -10 else "stable"),
        })
    return results


# ---------------------------------------------------------------------------
# Recurring patterns (zone × sector hotspots)
# ---------------------------------------------------------------------------

def recurring_patterns(
    issues: list[dict],
    threshold: int = 2,
    zone: Optional[str] = None,
) -> list[dict]:
    """
    Identify zone × sector pairs with repeated submissions exceeding `threshold`.

    Returns list of { zone, sector, count, severity } sorted by count desc.
    """
    if zone:
        issues = [i for i in issues if zone_matches_scope(i.get("zone"), zone)]

    pattern_counts: dict[tuple[str, str], int] = defaultdict(int)
    for iss in issues:
        z = str(iss.get("zone") or "unknown")
        s = str((iss.get("sector") or "other")).lower()
        pattern_counts[(z, s)] += 1

    results = []
    for (z, s), count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        if count >= threshold:
            results.append({
                "zone": z,
                "sector": s,
                "count": count,
                "severity": "critical" if count > 10 else ("high" if count > 5 else "medium"),
            })
    return results


# ---------------------------------------------------------------------------
# Response time trend (rolling window avg days-to-resolve)
# ---------------------------------------------------------------------------

def response_time_trend(
    issues: list[dict],
    window_days: int = 30,
    zone: Optional[str] = None,
) -> list[dict]:
    """
    Compute rolling average days-to-resolve over successive time windows.

    Each issue must have 'created_at'; resolved issues also need 'resolved_at'.
    Returns list of { period, avg_days, count } sorted by period asc.
    """
    if zone:
        issues = [i for i in issues if zone_matches_scope(i.get("zone"), zone)]

    resolved: list[dict] = []
    for iss in issues:
        created = iss.get("created_at")
        resolved_at = iss.get("resolved_at")
        if not created or not resolved_at:
            continue
        try:
            c_date = created.date() if hasattr(created, "date") else datetime.date.fromisoformat(str(created)[:10])
            r_date = resolved_at.date() if hasattr(resolved_at, "date") else datetime.date.fromisoformat(str(resolved_at)[:10])
            days = (r_date - c_date).days
            if days >= 0:
                resolved.append({"resolved_date": r_date, "days": days})
        except (ValueError, TypeError):
            continue

    if not resolved:
        return []

    resolved.sort(key=lambda x: x["resolved_date"])
    min_date = resolved[0]["resolved_date"]
    max_date = resolved[-1]["resolved_date"]

    results = []
    current = min_date
    while current <= max_date:
        window_end = current + datetime.timedelta(days=window_days)
        window_items = [r for r in resolved if current <= r["resolved_date"] < window_end]
        if window_items:
            avg = sum(r["days"] for r in window_items) / len(window_items)
            results.append({
                "period": current.isoformat(),
                "avg_days": round(avg, 1),
                "count": len(window_items),
            })
        current = window_end

    return results
