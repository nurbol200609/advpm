from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TimeSlot, Booking
from app.schemas import TimeslotRequest, TimeslotResponse
from app.utils import decode_token
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/timeslots", tags=["timeslots"])

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="no token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload

def require_admin(user):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="admin only")

def slot_response(db: Session, slot: TimeSlot):
    booked_count = db.query(Booking).filter(
        Booking.timeslot_id == slot.id,
        Booking.status == "active"
    ).count()
    return TimeslotResponse(
        id=slot.id,
        service_type=slot.service_type,
        start_time=slot.start_time,
        end_time=slot.end_time,
        capacity=slot.capacity,
        booked_count=booked_count
    )

def make_slots(db, service):
    now = datetime.utcnow()
    today_start = datetime.combine(now.date(), datetime.min.time())
    window_end = today_start + timedelta(days=3)

    existing_starts = {
        start_time
        for (start_time,) in db.query(TimeSlot.start_time).filter(
            TimeSlot.service_type == service,
            TimeSlot.start_time >= today_start,
            TimeSlot.start_time < window_end,
        ).all()
    }

    created = False
    for d in range(3):
        day = now.date() + timedelta(days=d)
        for h in range(9, 18):
            start = datetime.combine(day, datetime.min.time()) + timedelta(hours=h)
            if start <= now or start in existing_starts:
                continue
            slot = TimeSlot(
                service_type=service,
                start_time=start,
                end_time=start + timedelta(hours=1),
                capacity=10
            )
            db.add(slot)
            created = True
    if created:
        db.commit()

@router.post("/", response_model=TimeslotResponse)
def create_slot(data: TimeslotRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    if data.end_time <= data.start_time:
        raise HTTPException(status_code=400, detail="end time must be after start time")

    slot = TimeSlot(
        service_type=data.service_type,
        start_time=data.start_time,
        end_time=data.end_time,
        capacity=data.capacity,
        is_active=data.is_active
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot_response(db, slot)

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

@router.put("/{slot_id}", response_model=TimeslotResponse)
def update_slot(slot_id: str, data: TimeslotRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="slot not found")
    if data.end_time <= data.start_time:
        raise HTTPException(status_code=400, detail="end time must be after start time")

    slot.service_type = data.service_type
    slot.start_time = data.start_time
    slot.end_time = data.end_time
    slot.capacity = data.capacity
    slot.is_active = data.is_active
    db.commit()
    db.refresh(slot)
    return slot_response(db, slot)

@router.delete("/{slot_id}")
def delete_slot(slot_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    require_admin(user)
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="slot not found")

    active_bookings = db.query(Booking).filter(
        Booking.timeslot_id == slot_id,
        Booking.status == "active"
    ).count()
    if active_bookings:
        raise HTTPException(status_code=400, detail="slot has active bookings")

    slot.is_active = False
    db.commit()
    return {"msg": "deleted"}
