from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_async_engine(DATABASE_URL, echo=True)

@app.get("/")
async def root():
    return {"message": "Welcome to PropNexus API"}

@app.get("/properties")
async def get_properties():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT * FROM properties"))
        rows = result.fetchall()
        return [dict(row._mapping) for row in rows]