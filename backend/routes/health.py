from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
def health():
    return {
        "ok": True,
        "service": "propnexus-backend",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
