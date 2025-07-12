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
    allow_origins=["https://propnexus-platform-git-2872bb-mohammed-abbas-projects-8ab7e126.vercel.app"],  # ✅ Your Vercel frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Property schema
class Property(BaseModel):
    id: str
    title: str
    description: str
    location: str
    bedrooms: int
    bathrooms: int
    price: float
    imageurl: str
    source: str
    yield_percent: float
    roi_percent: float
    propertyType: str
    investmentType: str
    longitude: float
    latitude: float
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
        description,
        location,
        bedrooms,
        bathrooms,
        price,
        imageurl,
        source,
        yield_percent,
        roi_percent,
        propertyType,
        investmentType,
        longitude,
        latitude,
        created_at::text
    FROM properties
"""
    rows = await database.fetch_all(query)
    return rows
