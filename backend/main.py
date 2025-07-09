from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
import os
from databases import Database

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:your_password@host:port/dbname")
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
    price: float
    location: str
    bedrooms: int
    bathrooms: int
    description: str
    image: str
    yieldValue: float
    roi: float
    latitude: float
    longitude: float
    propertyType: str
    investmentType: str

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/api/properties", response_model=List[Property])
async def get_properties():
    query = """
        SELECT 
            id::text, 
            title, 
            price, 
            location, 
            bedrooms, 
            bathrooms, 
            description, 
            imageurl AS image, 
            yield_percent AS yieldValue, 
            roi_percent AS roi, 
            0.0 AS latitude, 
            0.0 AS longitude, 
            '' AS propertyType, 
            source AS investmentType
        FROM properties
    """
    rows = await database.fetch_all(query)
    return rows
