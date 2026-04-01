"""
GovLens ML Sidecar — FastAPI application.

Routes:
  GET  /                   — health check
  GET  /sentiment          — aggregate VADER sentiment (optional ?zone=)
  GET  /insights           — trend forecast (optional ?zone=, ?days=)
  POST /classify           — classify a single issue text into a sector

The NATS worker (worker.py) runs in the background via lifespan, automatically
classifying new issues published to the 'issue.created' subject.
"""

import asyncio
import os
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from classifier import classify, classify_proba
from insights import forecast
from sentiment import analyze, aggregate
from worker import start_worker

POSTGRES_URL = os.getenv(
    "POSTGRES_URL",
    "postgresql://govlens:password@localhost:5432/govlens"
)

# ---------------------------------------------------------------------------
# Lifespan: start NATS worker + DB pool
# ---------------------------------------------------------------------------
_db_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db_pool

    # Connect to PostgreSQL
    try:
        _db_pool = await asyncpg.create_pool(POSTGRES_URL)
        print("ML sidecar: connected to PostgreSQL")
    except Exception as e:
        print(f"ML sidecar: DB connection failed — {e}")
        _db_pool = None

    # Start NATS worker in background
    worker_task = asyncio.create_task(start_worker())

    yield

    # Cleanup
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    if _db_pool:
        await _db_pool.close()


app = FastAPI(title="GovLens ML Sidecar", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {"status": "ok", "service": "ml_sidecar", "db": _db_pool is not None}


# ---------------------------------------------------------------------------
# Sentiment endpoint
# ---------------------------------------------------------------------------
@app.get("/sentiment")
async def get_sentiment(zone: str | None = Query(default=None, description="Filter by constituency zone")):
    """
    Aggregate VADER sentiment across all (or zone-filtered) issues.
    Cached by the Go API layer for 10 min.
    """
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with _db_pool.acquire() as conn:
        if zone:
            rows = await conn.fetch(
                "SELECT title, description, zone FROM issues WHERE zone = $1", zone
            )
        else:
            rows = await conn.fetch(
                "SELECT title, description, zone FROM issues LIMIT 500"
            )

    records = [dict(r) for r in rows]
    result = aggregate(records)
    return result


# ---------------------------------------------------------------------------
# Insights endpoint
# ---------------------------------------------------------------------------
@app.get("/insights")
async def get_insights(
    zone: str | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=30, description="Days to forecast"),
):
    """
    Return OLS trend forecast for issue submission counts.
    """
    if _db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with _db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT created_at, zone FROM issues ORDER BY created_at ASC"
        )

    records = [dict(r) for r in rows]
    result = forecast(records, days_ahead=days, zone=zone)
    return result


# ---------------------------------------------------------------------------
# Classify endpoint
# ---------------------------------------------------------------------------
class ClassifyRequest(BaseModel):
    title: str
    description: str = ""


@app.post("/classify")
async def classify_issue(body: ClassifyRequest):
    """
    Classify a single issue into a sector using TF-IDF + Naive Bayes.
    Returns sector label plus confidence scores for all categories.
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
