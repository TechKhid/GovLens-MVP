import os
import json
import asyncio
import nats
from nats.errors import TimeoutError
import asyncpg
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://govlens:password@localhost:5432/govlens")

analyzer = SentimentIntensityAnalyzer()

async def process_issue(msg, pool):
    try:
        data = json.loads(msg.data.decode())
        issue_id = data.get("id")
        description = data.get("description", "")
        title = data.get("title", "")
        
        # Analyze sentiment
        text = f"{title}. {description}"
        sentiment_scores = analyzer.polarity_scores(text)
        compound = sentiment_scores['compound']
        
        severity = "low"
        if compound < -0.5:
            severity = "high"
        elif compound < 0:
            severity = "medium"
            
        # Basic sector classification stub
        sector = "other"
        text_lower = text.lower()
        if "road" in text_lower or "pothole" in text_lower or "traffic" in text_lower:
            sector = "infrastructure"
        elif "water" in text_lower or "pipe" in text_lower:
            sector = "utilities"
        elif "hospital" in text_lower or "health" in text_lower:
            sector = "healthcare"
            
        print(f"Processed issue {issue_id}: severity={severity}, sector={sector}")
        
        # Note: MVP expects ID as UUID string in postgres. pgtype UUID natively supports string parsing via asyncpg inside Go/Pg
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE issues SET severity = $1, sector = $2, updated_at = NOW() WHERE id = $3",
                severity, sector, issue_id
            )
            
        await msg.ack()
    except Exception as e:
        print(f"Error processing message: {e}")

async def start_worker():
    # Wait for dependent services to be fully ready in docker compose
    await asyncio.sleep(5)
    
    pool = await asyncpg.create_pool(POSTGRES_URL)
    nc = await nats.connect(NATS_URL)
    js = nc.jetstream()
    
    try:
        await js.add_stream(name="ISSUES", subjects=["issue.*"])
    except Exception:
        pass
        
    print("NATS Worker started, listening for 'issue.created'")
    
    sub = await js.pull_subscribe("issue.created", "ml_worker")
    
    while True:
        try:
            msgs = await sub.fetch(10, timeout=1.0)
            for msg in msgs:
                await process_issue(msg, pool)
        except TimeoutError:
            pass
        except Exception as e:
            print(f"Worker fetch error: {e}")
            await asyncio.sleep(1)
