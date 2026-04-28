from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Booking, TimeSlot, User
from app.schemas import BookingRequest, BookingResponse
from app.utils import decode_token
from datetime import datetime

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="no token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload


@router.post("/", response_model=BookingResponse)
def create_booking(data: BookingRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    slot = db.query(TimeSlot).filter(TimeSlot.id == data.timeslot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="slot not found")

    if slot.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="slot already passed")

    cnt = db.query(Booking).filter(
        Booking.timeslot_id == data.timeslot_id,
        Booking.status == "active"
    ).count()

    if cnt >= slot.capacity:
        raise HTTPException(status_code=400, detail="slot is full")

    already = db.query(Booking).filter(
        Booking.user_id == user["sub"],
        Booking.timeslot_id == data.timeslot_id,
        Booking.status == "active"
    ).first()
    if already:
        raise HTTPException(status_code=400, detail="already booked")

    booking = Booking(
        user_id=user["sub"],
        timeslot_id=data.timeslot_id,
        queue_number=cnt + 1,
        status="active"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/my", response_model=list[BookingResponse])
def my_bookings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    bookings = db.query(Booking).filter(
        Booking.user_id == user["sub"]
    ).order_by(Booking.created_at.desc()).all()
    return bookings


@router.delete("/{booking_id}")
def cancel_booking(booking_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="not found")
    if booking.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="not your booking")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="already cancelled")

    booking.status = "cancelled"
    db.commit()
    return {"msg": "cancelled"}


@router.get("/all")
def all_bookings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user["role"] not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="no access")
    bookings = db.query(Booking).order_by(Booking.created_at.desc()).all()
    return [{"id": b.id, "queue": b.queue_number, "status": b.status, "slot": b.timeslot_id} for b in bookings]


@router.get("/queue/{service_type}")
def get_service_queue(service_type: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user["role"] not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="access denied")

    if service_type not in ["cafe", "library", "deanery"]:
        raise HTTPException(status_code=400, detail="bad service")

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    slots = db.query(TimeSlot).filter(
        TimeSlot.service_type == service_type,
        TimeSlot.start_time >= today_start
    ).all()

    slot_ids = [s.id for s in slots]

    if not slot_ids:
        return {"service": service_type, "queue": [], "count": 0}

    queue = db.query(Booking).filter(
        Booking.timeslot_id.in_(slot_ids),
        Booking.status == "active"
    ).order_by(Booking.queue_number).all()

    result = []
    for b in queue:
        user_obj = db.query(User).filter(User.id == b.user_id).first()
        result.append({
            "booking_id": b.id,
            "queue_number": b.queue_number,
            "student_name": user_obj.name if user_obj else "?",
            "timeslot_id": b.timeslot_id
        })
    return {"service": service_type, "queue": result, "count": len(result)}


@router.post("/serve/{booking_id}")
def mark_served(booking_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user["role"] not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="access denied")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="not found")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="already served or cancelled")

    booking.status = "completed"
    db.commit()
    return {"msg": "served"}