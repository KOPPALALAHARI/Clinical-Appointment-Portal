from datetime import date, datetime, time, timezone
from typing import Annotated

from pydantic import BaseModel, Field, model_validator

from app.schemas.user import UserOut

_MAX_DATE_RANGE_DAYS = 90
_MAX_SLOTS_PER_REQUEST = 500


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_minutes: Annotated[int, Field(ge=5, le=480)] = 30
    max_patients: Annotated[int, Field(ge=1, le=100)] = 1

    @model_validator(mode="after")
    def validate_times(self):
        now = datetime.now(timezone.utc)
        if self.start_time.tzinfo is None:
            raise ValueError("start_time must include timezone info")
        if self.end_time.tzinfo is None:
            raise ValueError("end_time must include timezone info")
        if self.start_time <= now:
            raise ValueError("start_time must be in the future")
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        expected_minutes = int((self.end_time - self.start_time).total_seconds() // 60)
        if expected_minutes != self.duration_minutes:
            raise ValueError(
                f"end_time - start_time is {expected_minutes} min but duration_minutes is {self.duration_minutes}"
            )
        return self


class SlotBulkCreate(BaseModel):
    date_from: date
    date_to: date
    from_time: time
    to_time: time
    duration_minutes: Annotated[int, Field(ge=5, le=480)] = 30
    max_patients: Annotated[int, Field(ge=1, le=100)] = 1

    @model_validator(mode="after")
    def validate_range(self):
        today = date.today()
        if self.date_from < today:
            raise ValueError("date_from cannot be in the past")
        if self.date_to < self.date_from:
            raise ValueError("date_to must be on or after date_from")
        day_span = (self.date_to - self.date_from).days + 1
        if day_span > _MAX_DATE_RANGE_DAYS:
            raise ValueError(f"Date range cannot exceed {_MAX_DATE_RANGE_DAYS} days")
        if self.to_time <= self.from_time:
            raise ValueError("to_time must be after from_time")

        # Guard: estimate max slots and reject clearly oversized requests
        mins_per_day = (
            self.to_time.hour * 60 + self.to_time.minute
            - self.from_time.hour * 60 - self.from_time.minute
        )
        max_slots = (mins_per_day // self.duration_minutes) * day_span
        if max_slots > _MAX_SLOTS_PER_REQUEST:
            raise ValueError(
                f"This configuration would generate up to {max_slots} slots, "
                f"which exceeds the limit of {_MAX_SLOTS_PER_REQUEST}. "
                "Reduce the date range or increase the slot duration."
            )
        return self


class SlotOut(BaseModel):
    id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    max_patients: int
    is_available: bool
    booked_count: int = 0
    doctor: UserOut | None = None

    model_config = {"from_attributes": True}
