# 📄 /backend/routes/save_deal.py

from fastapi import APIRouter, Request
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@router.post("/save-deal")
async def save_deal(request: Request):
    try:
        payload = await request.json()
        response = supabase.table("saved_deals").insert(payload).execute()

        if response.error:
            return {"error": str(response.error)}
        
        return {"message": "Deal saved successfully", "data": response.data}
    
    except Exception as e:
        return {"error": f"Server error: {str(e)}"}
