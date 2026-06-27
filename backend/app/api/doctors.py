from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.slot import Slot
from app.models.user import Role, User
from app.schemas.appointment import AppointmentOut, AppointmentStatusUpdate
from app.schemas.slot import SlotBulkCreate, SlotCreate, SlotOut
from app.services.auth import require_role

router = APIRouter(prefix="/doctors", tags=["Doctors"])

_doctor = require_role(Role.DOCTOR)

_INVALID_TRANSITIONS = {
    AppointmentStatus.APPROVED:  {AppointmentStatus.REJECTED},
    AppointmentStatus.REJECTED:  {AppointmentStatus.APPROVED},
    AppointmentStatus.CANCELLED: {AppointmentStatus.APPROVED, AppointmentStatus.REJECTED},
}


def _active_count(slot: Slot) -> int:
    return sum(
        1 for a in slot.appointments
        if a.status in (AppointmentStatus.PENDING, AppointmentStatus.APPROVED)
    )


def _slot_out(slot: Slot) -> SlotOut:
    data = SlotOut.model_validate(slot)
    data.booked_count = _active_count(slot)
    return data


# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------

@router.post("/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED)
def create_slot(
    payload: SlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_doctor),
):
    if db.query(Slot).filter(
        Slot.doctor_id == current_user.id,
        Slot.start_time == payload.start_time,
    ).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A slot already exists at this start time",
        )

    slot = Slot(
        doctor_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        duration_minutes=payload.duration_minutes,
        max_patients=payload.max_patients,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_out(slot)


@router.post("/slots/bulk", status_code=status.HTTP_201_CREATED)
def create_slots_bulk(
    payload: SlotBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_doctor),
):
    candidates: list[tuple[datetime, datetime]] = []
    current_date = payload.date_from
    now_utc = datetime.now(timezone.utc)

    while current_date <= payload.date_to:
        slot_start = datetime(
            current_date.year, current_date.month, current_date.day,
            payload.from_time.hour, payload.from_time.minute,
            tzinfo=timezone.utc,
        )
        day_end = datetime(
            current_date.year, current_date.month, current_date.day,
            payload.to_time.hour, payload.to_time.minute,
            tzinfo=timezone.utc,
        )
        while slot_start < day_end:
            slot_end = slot_start + timedelta(minutes=payload.duration_minutes)
            if slot_end <= day_end and slot_start > now_utc:
                candidates.append((slot_start, slot_end))
            slot_start = slot_end
        current_date += timedelta(days=1)

    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No future slots could be generated with the given parameters",
        )

    # Skip duplicates — one query for all candidate start times
    existing_starts = {
        row.start_time
        for row in db.query(Slot.start_time).filter(
            Slot.doctor_id == current_user.id,
            Slot.start_time.in_([s for s, _ in candidates]),
        ).all()
    }

    new_slots = [
        Slot(
            doctor_id=current_user.id,
            start_time=start,
            end_time=end,
            duration_minutes=payload.duration_minutes,
            max_patients=payload.max_patients,
        )
        for start, end in candidates
        if start not in existing_starts
    ]

    skipped = len(candidates) - len(new_slots)
    if not new_slots:
        return {
            "created": 0,
            "skipped": skipped,
            "message": "All slots already exist — nothing created",
        }

    db.bulk_save_objects(new_slots)
    db.commit()
    return {
        "created": len(new_slots),
        "skipped": skipped,
        "message": (
            f"{len(new_slots)} slots created"
            + (f", {skipped} already existed and were skipped" if skipped else "")
        ),
    }


@router.get("/slots", response_model=list[SlotOut])
def list_my_slots(db: Session = Depends(get_db), current_user: User = Depends(_doctor)):
    slots = db.query(Slot).filter(Slot.doctor_id == current_user.id).order_by(Slot.start_time).all()
    return [_slot_out(s) for s in slots]


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointment_requests(db: Session = Depends(get_db), current_user: User = Depends(_doctor)):
    return (
        db.query(Appointment)
        .join(Slot, Appointment.slot_id == Slot.id)
        .filter(Slot.doctor_id == current_user.id)
        .order_by(Appointment.created_at.desc())
        .all()
    )


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_doctor),
):
    if appointment_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment ID")

    appt = (
        db.query(Appointment)
        .join(Slot, Appointment.slot_id == Slot.id)
        .filter(Appointment.id == appointment_id, Slot.doctor_id == current_user.id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if payload.status not in {AppointmentStatus.APPROVED, AppointmentStatus.REJECTED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctors can only APPROVE or REJECT appointments",
        )

    if appt.status == AppointmentStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a CANCELLED appointment",
        )

    if appt.status == payload.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Appointment is already {appt.status.value}",
        )

    blocked = _INVALID_TRANSITIONS.get(appt.status, set())
    if payload.status in blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from {appt.status.value} to {payload.status.value}",
        )

    appt.status = payload.status

    if payload.status == AppointmentStatus.REJECTED:
        active = _active_count(appt.slot)
        if active < appt.slot.max_patients:
            appt.slot.is_available = True

    db.commit()
    db.refresh(appt)
    return appt
