import os
from databases import Database

DATABASE_URL = os.getenv("DATABASE_URL", "your_fallback_url_here")
database = Database(DATABASE_URL)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel

app = FastAPI()

# ✅ Allow frontend calls (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or set your Vercel URL for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Define a Property schema
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

# ✅ Example fake DB data (replace this with your actual DB query)
properties_db = [
    {
        "id": "1",
        "title": "Modern Family Home",
        "price": 250000,
        "location": "Liverpool",
        "bedrooms": 3,
        "bathrooms": 2,
        "description": "A spacious family home with a large garden.",
        "image": "https://your-bucket.s3.amazonaws.com/house1.jpg",
        "yieldValue": 5.6,
        "roi": 11.2,
        "latitude": 53.4084,
        "longitude": -2.9916,
        "propertyType": "House",
        "investmentType": "Buy to Let"
    },
    {
        "id": "2",
        "title": "City Apartment",
        "price": 180000,
        "location": "Newcastle upon Tyne",
        "bedrooms": 2,
        "bathrooms": 1,
        "description": "A modern apartment in the heart of the city.",
        "image": "https://your-bucket.s3.amazonaws.com/apartment1.jpg",
        "yieldValue": 5.1,
        "roi": 9.4,
        "latitude": 54.9783,
        "longitude": -1.6178,
        "propertyType": "Apartment",
        "investmentType": "Flip"
    }
]

# ✅ API route
@app.get("/api/properties", response_model=List[Property])
async def get_properties():
    # 🔥 Later: Replace this with DB call like: database.fetch_all_properties()
    return properties_db
