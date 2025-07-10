from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
import os
from databases import Database

# ✅ Database URL (adjust as needed)
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

# ✅ Property schema matches frontend keys
class Property(BaseModel):
    id: str
    title: str
    price: float
    location: str
    bedrooms: int
    bathrooms: int
    description: str
    image: str         # ✅ uses alias from query
    yieldValue: float  # ✅ uses alias from query
    roi: float         # ✅ uses alias from query
    bmv: float
    created_at: str
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

@app.get("/properties", response_model=List[Property])
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
            imageurl AS image,           -- ✅ alias to match frontend
            yield_percent AS yieldValue, -- ✅ alias to match frontend
            roi_percent AS roi,          -- ✅ alias to match frontend
            bmv,                         -- ✅ directly included
            created_at,
            0.0 AS latitude, 
            0.0 AS longitude, 
            '' AS propertyType, 
            source AS investmentType
        FROM properties
    """
    rows = await database.fetch_all(query)
    return rows
