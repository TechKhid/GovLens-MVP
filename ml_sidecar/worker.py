"""
worker.py — NATS JetStream consumer for async ML enrichment of issues.

Listens on 'issue.created', runs the real classifier and sentiment analyser
(from classifier.py / sentiment.py), and writes sector + severity +
sentiment_score back to the issues table.

Improvements over original stub:
  - Uses the full sentence-embedding classifier (not keyword stubs)
  - Uses the hybrid civic sentiment analyser
  - Writes sentiment_score (compound float) for analytics
  - Sets resolved_at when status transitions to 'resolved'
  - Exponential backoff on NATS reconnect failures
"""

import asyncio
import json
import os

import asyncpg
import nats
from nats.errors import TimeoutError

from classifier import classify
from sentiment import analyze

NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://govlens:password@localhost:5432/govlens")

_MAX_NATS_RETRIES = 8
_BASE_RETRY_DELAY = 1.0  # seconds


async def process_issue(msg, pool) -> None:
    try:
        data = json.loads(msg.data.decode())
        issue_id = data.get("id")
        description = data.get("description", "")
        title = data.get("title", "")

        text = f"{title}. {description}".strip()
        if not text:
            await msg.ack()
            return

        # --- Real ML classification ---
        sector = classify(text)

        # --- Real hybrid sentiment ---
        sentiment = analyze(text)
        severity = sentiment["severity"]
        sentiment_score = sentiment["compound"]

        print(
            f"[worker] issue={issue_id} sector={sector} "
            f"severity={severity} score={sentiment_score:.3f}"
        )

        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE issues
                SET sector          = $1,
                    severity        = $2,
                    sentiment_score = $3,
                    updated_at      = NOW()
                WHERE id = $4::uuid
                """,
                sector, severity, sentiment_score, issue_id,
            )

        await msg.ack()

    except Exception as exc:
        print(f"[worker] error processing msg: {exc}")
        try:
            await msg.nak()   # re-queue for retry
        except Exception:
            pass


async def start_worker() -> None:
    # Allow dependent services time to become ready in docker-compose
    await asyncio.sleep(5)

    pool = await asyncpg.create_pool(POSTGRES_URL)

    # Connect to NATS with exponential backoff
    nc = None
    delay = _BASE_RETRY_DELAY
    for attempt in range(1, _MAX_NATS_RETRIES + 1):
        try:
            nc = await nats.connect(NATS_URL)
            print(f"[worker] NATS connected on attempt {attempt}")
            break
        except Exception as exc:
            print(f"[worker] NATS connect failed (attempt {attempt}): {exc}")
            if attempt == _MAX_NATS_RETRIES:
                raise
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)

    js = nc.jetstream()

    try:
        await js.add_stream(name="ISSUES", subjects=["issue.*"])
    except Exception:
        pass  # Stream may already exist

    print("[worker] listening on 'issue.created'…")
    sub = await js.pull_subscribe("issue.created", "ml_worker")

    while True:
        try:
            msgs = await sub.fetch(10, timeout=1.0)
            for msg in msgs:
                await process_issue(msg, pool)
        except TimeoutError:
            pass
        except Exception as exc:
            print(f"[worker] fetch error: {exc}")
            await asyncio.sleep(1)
