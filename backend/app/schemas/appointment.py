from datetime import datetime

from pydantic import BaseModel

from app.models.appointment import AppointmentStatus
from app.schemas.slot import SlotOut
from app.schemas.user import UserOut


class AppointmentCreate(BaseModel):
    slot_id: int


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    slot_id: int
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    patient: UserOut | None = None
    slot: SlotOut | None = None

    model_config = {"from_attributes": True}
