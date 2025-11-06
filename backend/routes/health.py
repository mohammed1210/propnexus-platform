"""Health check endpoint for monitoring backend service status."""

from datetime import datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {
        "ok": True,
        "service": "propnexus-backend",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
