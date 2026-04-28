from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import uuid

def gen_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String(20), default="student")  # student / staff / admin
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")
    preorders = relationship("PreOrder", back_populates="user")


class TimeSlot(Base):
    __tablename__ = "timeslots"

    id = Column(String, primary_key=True, default=gen_uuid)
    service_type = Column(String(20), nullable=False)  # cafe / library / deanery
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    capacity = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)

    bookings = relationship("Booking", back_populates="timeslot")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    timeslot_id = Column(String, ForeignKey("timeslots.id"), nullable=False)
    queue_number = Column(Integer, nullable=False)
    status = Column(String(20), default="active")  # active / cancelled / completed
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    timeslot = relationship("TimeSlot", back_populates="bookings")


class PreOrder(Base):
    __tablename__ = "preorders"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    items = Column(Text, nullable=False)  # JSON строка
    total_price = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending / ready / picked_up
    pickup_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="preorders")
