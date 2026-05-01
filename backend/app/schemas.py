from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List

# AUTH
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="student", pattern="^(student|staff|admin)$")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_role: str

#  TIMESLOTS
class TimeslotResponse(BaseModel):
    id: str
    service_type: str
    start_time: datetime
    end_time: datetime
    capacity: int
    booked_count: int

    class Config:
        from_attributes = True

#  BOOKINGS
class BookingRequest(BaseModel):
    timeslot_id: str
    service_type: str = Field(..., pattern="^(cafe|library|deanery)$")

class BookingResponse(BaseModel):
    id: str
    queue_number: int
    status: str
    timeslot_id: str
    created_at: datetime

    class Config:
        from_attributes = True

#  PREORDERS
class PreOrderItem(BaseModel):
    name: str
    price: int
    quantity: int

class PreOrderRequest(BaseModel):
    items: List[PreOrderItem]
    pickup_time: datetime

class PreOrderResponse(BaseModel):
    id: str
    status: str
    total_price: int
    pickup_time: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
