"""Tradesmen routes for finding and contacting local tradespeople."""

from __future__ import annotations

import logging
import math
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from backend.utils.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tradesmen", tags=["tradesmen"])


# ======================
# Request/Response Models
# ======================
class TradesmanResponse(BaseModel):
    """Response model for a single tradesman."""

    id: str
    full_name: str
    trade_type: str
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: float = 0.0
    distance_km: Optional[float] = None
    service_radius_km: int = 20


class ContactTradesmanRequest(BaseModel):
    """Request to contact a tradesman."""

    tradesman_id: str = Field(..., description="UUID of the tradesman")
    property_id: Optional[str] = Field(None, description="UUID of the property (optional)")
    user_email: str = Field(..., description="User's email address")
    message: str = Field(..., min_length=10, description="Message to send to tradesman")


class ContactTradesmanResponse(BaseModel):
    """Response after contacting a tradesman."""

    success: bool
    lead_id: Optional[str] = None
    message: str = "Contact request sent successfully"


# ======================
# Helper Functions
# ======================
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    Returns distance in kilometers.

    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates

    Returns:
        Distance in kilometers
    """
    # Radius of Earth in kilometers
    R = 6371.0

    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    # Haversine formula
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance


# ======================
# Routes
# ======================
@router.get("/nearby", response_model=list[TradesmanResponse])
def get_nearby_tradesmen(
    lat: float,
    lng: float,
    trade_type: Optional[str] = None,
    radius_km: int = 20,
):
    """
    Get tradesmen near a specific location.

    Query parameters:
    - lat: Latitude of the property/location
    - lng: Longitude of the property/location
    - trade_type: Optional filter by trade type (e.g., "builder", "plumber")
    - radius_km: Search radius in kilometers (default: 20)

    Returns:
        List of tradesmen within the radius, ordered by distance ascending
    """
    sb = get_supabase()
    if not sb:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not available",
        )

    try:
        # Build query
        query = sb.table("tradesmen").select("*")

        # Filter by trade type if provided
        if trade_type:
            query = query.eq("trade_type", trade_type.lower())

        # Execute query
        response = query.execute()

        if not response.data:
            return []

        # Calculate distances and filter by radius
        tradesmen_with_distance = []
        for tradesman in response.data:
            t_lat = tradesman.get("latitude")
            t_lng = tradesman.get("longitude")

            # Skip tradesmen without location data
            if t_lat is None or t_lng is None:
                continue

            # Calculate distance
            distance = haversine_distance(lat, lng, float(t_lat), float(t_lng))

            # Check if within service radius (use larger of search radius or tradesman's service radius)
            service_radius = tradesman.get("service_radius_km", 20)
            max_radius = max(radius_km, service_radius)

            if distance <= max_radius:
                tradesmen_with_distance.append(
                    {
                        "id": tradesman["id"],
                        "full_name": tradesman["full_name"],
                        "trade_type": tradesman["trade_type"],
                        "email": tradesman.get("email"),
                        "phone": tradesman.get("phone"),
                        "website": tradesman.get("website"),
                        "rating": float(tradesman.get("rating", 0)),
                        "distance_km": round(distance, 1),
                        "service_radius_km": service_radius,
                    }
                )

        # Sort by distance ascending
        tradesmen_with_distance.sort(key=lambda x: x["distance_km"])

        return tradesmen_with_distance

    except Exception as e:
        logger.error(f"Error fetching nearby tradesmen: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tradesmen: {str(e)}",
        )


@router.post("/contact", response_model=ContactTradesmanResponse)
def contact_tradesman(request: ContactTradesmanRequest):
    """
    Send a contact message to a tradesman.

    Body:
    - tradesman_id: UUID of the tradesman to contact
    - property_id: Optional UUID of the property being discussed
    - user_email: Email address of the user
    - message: Message content

    Returns:
        Success response with lead_id
    """
    sb = get_supabase()
    if not sb:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service not available",
        )

    try:
        # Verify tradesman exists
        tradesman_response = (
            sb.table("tradesmen")
            .select("id, full_name, email")
            .eq("id", request.tradesman_id)
            .single()
            .execute()
        )

        if not tradesman_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tradesman not found",
            )

        tradesman = tradesman_response.data

        # Create lead record
        lead_data = {
            "tradesman_id": request.tradesman_id,
            "property_id": request.property_id,
            "user_email": request.user_email,
            "message": request.message,
            "status": "sent",
        }

        lead_response = sb.table("tradesmen_leads").insert(lead_data).execute()

        if not lead_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create lead record",
            )

        lead_id = lead_response.data[0]["id"]

        # TODO: Send email notification to tradesman
        # For now, we're just storing the lead. Email integration can be added later
        # using existing email utilities (Resend API, Mailgun, etc.)
        tradesman_email = tradesman.get("email")
        if tradesman_email:
            logger.info(
                f"Lead created: {lead_id}. "
                f"Would send email to {tradesman_email} from {request.user_email}"
            )
            # Future: Call email service here
            # send_tradesman_contact_email(
            #     to_email=tradesman_email,
            #     from_email=request.user_email,
            #     tradesman_name=tradesman["full_name"],
            #     message=request.message,
            #     property_id=request.property_id,
            # )

        return ContactTradesmanResponse(
            success=True,
            lead_id=lead_id,
            message="Contact request sent successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error contacting tradesman: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send contact request: {str(e)}",
        )
