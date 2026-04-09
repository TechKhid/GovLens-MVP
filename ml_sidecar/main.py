"""
GovLens ML Sidecar — FastAPI application.

Routes:
  GET  /                        — health check
  GET  /sentiment               — aggregate VADER+hybrid sentiment (optional ?zone=)
  GET  /insights                — Prophet trend forecast (optional ?zone=, ?days=)
  POST /classify                — classify a single issue text into a sector
  GET  /sector-insights         — top sectors + per-sector sentiment (optional ?zone=)
  GET  /recurring               — zone × sector recurring patterns (optional ?zone=, ?threshold=)
  GET  /response-trend          — rolling avg days-to-resolve (optional ?zone=, ?window_days=)

The NATS worker (worker.py) runs in the background via lifespan, automatically
enriching new issues published to the 'issue.created' NATS subject.
"""

import asyncio
import os
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from classifier import classify, classify_proba
from geo_scope import zone_matches_scope
from insights import forecast, top_sectors, recurring_patterns, response_time_trend
from sentiment import analyze, aggregate, aggregate_by_sector
from worker import start_worker

POSTGRES_URL = os.getenv(
    "POSTGRES_URL",
    "postgresql://govlens:password@localhost:5432/govlens",
)

# ---------------------------------------------------------------------------
# Lifespan: DB pool + NATS worker
# ---------------------------------------------------------------------------
_db_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_pool
    try:
        _db_pool = await asyncpg.create_pool(POSTGRES_URL)
        print("ML sidecar: connected to PostgreSQL")
    except Exception as exc:
        print(f"ML sidecar: DB connection failed — {exc}")
        _db_pool = None

    worker_task = asyncio.create_task(start_worker())
    yield

    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    if _db_pool:
        await _db_pool.close()


app = FastAPI(title="GovLens ML Sidecar", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_db() -> asyncpg.Pool:
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return _db_pool


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"status": "ok", "service": "ml_sidecar", "version": "2.0.0", "db": _db_pool is not None}


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

@app.get("/sentiment")
async def get_sentiment(
    zone: str | None = Query(default=None, description="Filter by constituency zone"),
):
    """
    Aggregate hybrid sentiment across all (or zone-filtered) issues.
    Returns VADER + civic urgency scores and severity distribution.
    Cached by the Go API layer for 10 min.
    """
    pool = _require_db()
    async with pool.acquire() as conn:
        if zone:
            rows = await conn.fetch(
                "SELECT title, description, zone FROM issues"
            )
        else:
            rows = await conn.fetch(
                "SELECT title, description, zone FROM issues LIMIT 500"
            )
    records = [dict(r) for r in rows]
    if zone:
        records = [r for r in records if zone_matches_scope(r.get("zone"), zone)]
    return aggregate(records)


# ---------------------------------------------------------------------------
# Insights (trend forecast)
# ---------------------------------------------------------------------------

@app.get("/insights")
async def get_insights(
    zone: str | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=30, description="Days to forecast"),
):
    """
    Return Prophet trend forecast for issue submission counts.
    Includes uncertainty bands (lower/upper) and model name used.
    """
    pool = _require_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT created_at, zone FROM issues ORDER BY created_at ASC"
        )
    return forecast([dict(r) for r in rows], days_ahead=days, zone=zone)


# ---------------------------------------------------------------------------
# Classify
# ---------------------------------------------------------------------------

class ClassifyRequest(BaseModel):
    title: str
    description: str = ""


@app.post("/classify")
async def classify_issue(body: ClassifyRequest):
    """
    Classify a single issue into a sector using sentence-embedding prototype classifier.
    Returns sector label + calibrated confidence scores, plus hybrid severity.
    """
    text = f"{body.title}. {body.description}"
    result = classify_proba(text)
    sentiment = analyze(text)
    return {
        "sector": result["sector"],
        "sector_scores": result["scores"],
        "severity": sentiment["severity"],
        "sentiment": sentiment,
    }


# ---------------------------------------------------------------------------
# Sector insights (top sectors + per-sector sentiment)
# ---------------------------------------------------------------------------

@app.get("/sector-insights")
async def get_sector_insights(
    zone: str | None = Query(default=None),
    top_n: int = Query(default=5, ge=1, le=10),
):
    """
    Returns:
      - top_sectors: ranked sectors with count + period-over-period % change
      - sentiment_by_sector: avg sentiment + severity distribution per sector
    """
    pool = _require_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT title, description, sector, zone, created_at FROM issues ORDER BY created_at ASC"
        )

    records = [dict(r) for r in rows]
    sectors = top_sectors(records, n=top_n, zone=zone)
    sentiment = aggregate_by_sector(
        [r for r in records if zone_matches_scope(r.get("zone"), zone)]
    )

    return {
        "top_sectors": sectors,
        "sentiment_by_sector": sentiment,
    }


# ---------------------------------------------------------------------------
# Recurring patterns
# ---------------------------------------------------------------------------

@app.get("/recurring")
async def get_recurring(
    zone: str | None = Query(default=None),
    threshold: int = Query(default=2, ge=1, le=50),
):
    """
    Identify zone × sector pairs with repeated issue submissions.
    Useful for flagging systemic problems that need structural fixes.
    """
    pool = _require_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT sector, zone FROM issues WHERE sector IS NOT NULL"
        )
    return {"patterns": recurring_patterns([dict(r) for r in rows], threshold=threshold, zone=zone)}


# ---------------------------------------------------------------------------
# Response time trend
# ---------------------------------------------------------------------------

@app.get("/response-trend")
async def get_response_trend(
    zone: str | None = Query(default=None),
    window_days: int = Query(default=30, ge=7, le=90),
):
    """
    Rolling average days-to-resolve over successive time windows.
    Requires resolved_at to be populated (set when issue status → 'resolved').
    """
    pool = _require_db()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT created_at, resolved_at, zone
            FROM issues
            WHERE status = 'resolved' AND resolved_at IS NOT NULL
            ORDER BY resolved_at ASC
            """
        )
    return {"trend": response_time_trend([dict(r) for r in rows], window_days=window_days, zone=zone)}
