from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TimeSlot, Booking
from app.schemas import TimeslotResponse
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/timeslots", tags=["timeslots"])

def make_slots(db, service):
    check = db.query(TimeSlot).filter(TimeSlot.service_type == service).first()
    if check:
        return
    now = datetime.utcnow()
    for d in range(3):
        day = now.date() + timedelta(days=d)
        for h in range(9, 18):
            start = datetime.combine(day, datetime.min.time()) + timedelta(hours=h)
            slot = TimeSlot(
                service_type=service,
                start_time=start,
                end_time=start + timedelta(hours=1),
                capacity=10
            )
            db.add(slot)
    db.commit()

@router.get("/available", response_model=list[TimeslotResponse])
def get_slots(service_type: str = None, db: Session = Depends(get_db)):
    all_services = ["cafe", "library", "deanery"]

    if service_type:
        if service_type not in all_services:
            raise HTTPException(status_code=400, detail="wrong service type")
        make_slots(db, service_type)
        filtered = [service_type]
    else:
        for s in all_services:
            make_slots(db, s)
        filtered = all_services

    now = datetime.utcnow()
    slots = db.query(TimeSlot).filter(
        TimeSlot.service_type.in_(filtered),
        TimeSlot.start_time > now,
        TimeSlot.is_active == True
    ).order_by(TimeSlot.start_time).all()

    res = []
    for s in slots:
        cnt = db.query(Booking).filter(
            Booking.timeslot_id == s.id,
            Booking.status == "active"
        ).count()
        if cnt < s.capacity:
            res.append(TimeslotResponse(
                id=s.id,
                service_type=s.service_type,
                start_time=s.start_time,
                end_time=s.end_time,
                capacity=s.capacity,
                booked_count=cnt
            ))
    return res

@router.get("/queue/{slot_id}")
def queue_info(slot_id: str, db: Session = Depends(get_db)):
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="not found")

    bookings = db.query(Booking).filter(
        Booking.timeslot_id == slot_id,
        Booking.status == "active"
    ).order_by(Booking.queue_number).all()

    return {
        "service": slot.service_type,
        "time": slot.start_time,
        "queue": [{"num": b.queue_number, "id": b.id} for b in bookings],
        "total": len(bookings)
    }
