from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
import os
from databases import Database

DATABASE_URL = os.getenv("DATABASE_URL")
database = Database(DATABASE_URL)

app = FastAPI()

# ✅ Allow frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Property schema
class Property(BaseModel):
    id: str
    title: str
    location: str
    price: float
    imageurl: str
    description: str
    source: str
    yield_percent: float
    roi_percent: float
    bmv: float
    created_at: str

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/properties", response_model=List[Property])
async def get_properties():
    query = """
        SELECT 
            id::text, 
            title, 
            location, 
            price, 
            imageurl, 
            description, 
            source, 
            yield_percent, 
            roi_percent, 
            bmv, 
            created_at::text
        FROM properties
    """
    rows = await database.fetch_all(query)
    return rows
