# backend/routes/properties.py

from fastapi import APIRouter, HTTPException
from supabase import create_client
import os

router = APIRouter()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")
)

@router.get("/api/properties/{property_id}")
def get_property_by_id(property_id: str):
    response = supabase.table("properties").select("*").eq("id", property_id).single().execute()
    data = response.data
    if not data:
        raise HTTPException(status_code=404, detail="Property not found")
    return data
