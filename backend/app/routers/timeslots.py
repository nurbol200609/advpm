from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import TimeslotResponse
from app.database import db

router = APIRouter(prefix="/api/timeslots", tags=["timeslots"])

@router.get("/available", response_model=List[TimeslotResponse])
async def get_available_timeslots(
    service_type: Optional[str] = Query(None, pattern="^(cafe|library|deanery)$")
):
    """Получить список доступных тайм-слотов"""
    try:
        slots = db.get_available_slots(service_type)
        return slots
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))