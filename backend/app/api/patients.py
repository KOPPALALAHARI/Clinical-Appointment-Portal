from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.slot import Slot
from app.models.user import Role, User
from app.schemas.appointment import AppointmentCreate, AppointmentOut
from app.schemas.slot import SlotOut
from app.schemas.user import UserOut
from app.services.auth import require_role

router = APIRouter(prefix="/patients", tags=["Patients"])

_patient = require_role(Role.PATIENT)


def _active_count(slot: Slot) -> int:
    return sum(
        1 for a in slot.appointments
        if a.status in (AppointmentStatus.PENDING, AppointmentStatus.APPROVED)
    )


# ---------------------------------------------------------------------------
# Doctors
# ---------------------------------------------------------------------------

@router.get("/doctors", response_model=list[UserOut])
def list_doctors(db: Session = Depends(get_db), _: User = Depends(_patient)):
    return db.query(User).filter(User.role == Role.DOCTOR).order_by(User.name).all()


@router.get("/doctors/{doctor_id}/slots", response_model=list[SlotOut])
def list_available_slots(
    doctor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_patient),
):
    if doctor_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid doctor ID")

    doctor = db.query(User).filter(User.id == doctor_id, User.role == Role.DOCTOR).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    now = datetime.now(timezone.utc)
    return (
        db.query(Slot)
        .filter(
            Slot.doctor_id == doctor_id,
            Slot.is_available == True,
            Slot.start_time > now,        # hide slots whose time has already passed
        )
        .order_by(Slot.start_time)
        .all()
    )


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_patient),
):
    if payload.slot_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid slot ID")

    slot = db.query(Slot).filter(Slot.id == payload.slot_id).first()
    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slot not found")

    if not slot.is_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slot is fully booked")

    # Reject booking past slots
    if slot.start_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot book a slot that has already passed")

    # Prevent same patient from booking the same slot twice
    already_booked = db.query(Appointment).filter(
        Appointment.slot_id == payload.slot_id,
        Appointment.patient_id == current_user.id,
        Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.APPROVED]),
    ).first()
    if already_booked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active booking for this slot",
        )

    appointment = Appointment(
        patient_id=current_user.id,
        slot_id=payload.slot_id,
        status=AppointmentStatus.PENDING,
    )
    db.add(appointment)

    # Mark slot unavailable if this fills max_patients
    if _active_count(slot) + 1 >= slot.max_patients:
        slot.is_available = False

    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/appointments", response_model=list[AppointmentOut])
def my_appointments(db: Session = Depends(get_db), current_user: User = Depends(_patient)):
    return (
        db.query(Appointment)
        .filter(Appointment.patient_id == current_user.id)
        .order_by(Appointment.created_at.desc())
        .all()
    )


@router.patch("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_patient),
):
    if appointment_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid appointment ID")

    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == current_user.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status == AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Appointment is already cancelled")

    if appt.status != AppointmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only PENDING appointments can be cancelled (current status: {appt.status.value})",
        )

    appt.status = AppointmentStatus.CANCELLED

    # Restore slot availability if capacity opens up
    if _active_count(appt.slot) - 1 < appt.slot.max_patients:
        appt.slot.is_available = True

    db.commit()
    db.refresh(appt)
    return appt
