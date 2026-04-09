from datetime import datetime, timedelta
from typing import Dict
from dataclasses import dataclass
from uuid import uuid4


@dataclass
class Booking:
    id: str
    student_name: str
    student_email: str
    service_type: str
    timeslot_start: datetime
    timeslot_end: datetime
    created_at: datetime

    def to_dict(self):
        return {
            "id": self.id,
            "student_name": self.student_name,
            "student_email": self.student_email,
            "service_type": self.service_type,
            "timeslot_start": self.timeslot_start.isoformat(),
            "timeslot_end": self.timeslot_end.isoformat(),
            "created_at": self.created_at.isoformat()
        }


class Database:
    def __init__(self):
        self.bookings: Dict[str, Booking] = {}
        self.available_slots = self._generate_timeslots()

    def _generate_timeslots(self):
        """Генерирует тайм-слоты на сегодня и завтра"""
        slots = []
        now = datetime.now()

        for day_offset in range(2):
            base_date = now.date() + timedelta(days=day_offset)

            for hour in range(9, 18):
                slot_start = datetime.combine(base_date, datetime.min.time()) + timedelta(hours=hour)
                slot_end = slot_start + timedelta(hours=1)

                if slot_start > now:
                    slots.append({
                        "id": f"{slot_start.isoformat()}",
                        "start_time": slot_start,
                        "end_time": slot_end,
                        "is_available": True
                    })

        return slots

    def get_available_slots(self, service_type: str = None):
        """Возвращает доступные слоты, исключая уже забронированные"""
        booked_times = []
        for booking in self.bookings.values():
            if service_type is None or booking.service_type == service_type:
                booked_times.append((booking.timeslot_start, booking.timeslot_end))

        available = []
        for slot in self.available_slots:
            if slot["start_time"] < datetime.now():
                continue

            is_booked = any(
                slot["start_time"] == booked_start and slot["end_time"] == booked_end
                for booked_start, booked_end in booked_times
            )

            if not is_booked:
                available.append({
                    "slot_id": slot["id"],
                    "start_time": slot["start_time"].isoformat(),
                    "end_time": slot["end_time"].isoformat(),
                    "service_type": service_type if service_type else "all"
                })

        return available

    def create_booking(self, student_name: str, student_email: str,
                       service_type: str, slot_id: str):
        """Создаёт новое бронирование"""
        selected_slot = None
        for slot in self.available_slots:
            if slot["id"] == slot_id:
                selected_slot = slot
                break

        if not selected_slot:
            raise ValueError("Тайм-слот не найден")

        for booking in self.bookings.values():
            if (booking.timeslot_start == selected_slot["start_time"] and
                    booking.service_type == service_type):
                raise ValueError("Этот тайм-слот уже забронирован")

        booking = Booking(
            id=str(uuid4()),
            student_name=student_name,
            student_email=student_email,
            service_type=service_type,
            timeslot_start=selected_slot["start_time"],
            timeslot_end=selected_slot["end_time"],
            created_at=datetime.now()
        )

        self.bookings[booking.id] = booking
        return booking

    def get_all_bookings(self, service_type: str = None):
        """Возвращает все бронирования"""
        bookings_list = [b.to_dict() for b in self.bookings.values()]

        if service_type:
            bookings_list = [b for b in bookings_list if b["service_type"] == service_type]

        return sorted(bookings_list, key=lambda x: x["timeslot_start"])


db = Database()