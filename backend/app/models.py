from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class TimeslotResponse(BaseModel):
    slot_id: str
    start_time: datetime
    end_time: datetime
    service_type: str

class BookingRequest(BaseModel):
    student_name: str = Field(..., min_length=2, max_length=100)
    student_email: EmailStr
    service_type: str = Field(..., pattern="^(cafe|library|deanery)$")
    slot_id: str

class BookingResponse(BaseModel):
    id: str
    student_name: str
    student_email: str
    service_type: str
    timeslot_start: datetime
    timeslot_end: datetime
    created_at: datetime

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None