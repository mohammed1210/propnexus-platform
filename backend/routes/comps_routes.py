from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()

@router.get("/comps/{postcode}")
async def get_comps(postcode: str) -> Dict[str, Any]:
    """
    Return nearby comparables (sales and rents) for a postcode.
    This is a stub — integrate live APIs or your Supabase tables later.
    """
    # 🔧 Example mock data (replace with DB query / API later)
    return {
        "postcode": postcode,
        "sales": [
            {"price": 245000, "date": "2024-11-15", "bedrooms": 3, "distance_miles": 0.4},
            {"price": 260000, "date": "2024-12-01", "bedrooms": 2, "distance_miles": 0.7},
        ],
        "rents": [
            {"monthly_rent": 1200, "bedrooms": 2, "date": "2025-01-20"},
            {"monthly_rent": 1350, "bedrooms": 3, "date": "2025-02-10"},
        ],
        "note": "Stubbed data — replace with live integration",
    }
