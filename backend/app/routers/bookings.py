from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import BookingRequest, BookingResponse
from app.database import db

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.post("/", response_model=BookingResponse, status_code=201)
async def create_booking(booking: BookingRequest):
    """Создать новое бронирование"""
    try:
        new_booking = db.create_booking(
            student_name=booking.student_name,
            student_email=booking.student_email,
            service_type=booking.service_type,
            slot_id=booking.slot_id
        )
        return new_booking.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")

@router.get("/", response_model=List[BookingResponse])
async def get_all_bookings(
    service_type: Optional[str] = Query(None, pattern="^(cafe|library|deanery)$")
):
    """Получить список всех бронирований"""
    try:
        bookings = db.get_all_bookings(service_type)
        return bookings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{booking_id}")
async def cancel_booking(booking_id: str):
    """Отменить бронирование по ID"""
    if booking_id in db.bookings:
        del db.bookings[booking_id]
        return {"message": "Бронирование успешно отменено"}
    else:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")