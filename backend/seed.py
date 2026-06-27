"""
Run from the backend directory with the venv active:
    python seed.py
"""
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.appointment import Appointment, AppointmentStatus
from app.models.slot import Slot
from app.models.user import Role, User

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

DOCTORS = [
    {"name": "Dr. Ananya Sharma",  "email": "ananya.sharma@clinic.com",  "password": "doctor123"},
    {"name": "Dr. Ravi Menon",     "email": "ravi.menon@clinic.com",     "password": "doctor123"},
    {"name": "Dr. Priya Nair",     "email": "priya.nair@clinic.com",     "password": "doctor123"},
]

PATIENTS = [
    {"name": "Arjun Patel",   "email": "arjun.patel@mail.com",   "password": "patient123"},
    {"name": "Sneha Reddy",   "email": "sneha.reddy@mail.com",   "password": "patient123"},
    {"name": "Kiran Kumar",   "email": "kiran.kumar@mail.com",   "password": "patient123"},
    {"name": "Meera Joshi",   "email": "meera.joshi@mail.com",   "password": "patient123"},
]

# Slots per doctor: list of (start_offset_days, start_hour, duration_minutes)
SLOT_TEMPLATES = [
    (1,  9,  30),
    (1, 10,  30),
    (1, 11,  30),
    (2,  9,  30),
    (2, 14,  30),
    (3, 10,  30),
    (3, 15,  30),
]


def make_slot_times(day_offset: int, hour: int, duration_minutes: int):
    base = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = base + timedelta(days=day_offset, hours=hour - base.hour)
    end   = start + timedelta(minutes=duration_minutes)
    return start, end


def seed():
    db = SessionLocal()
    try:
        # Skip if data already exists
        if db.query(User).first():
            print("Database already has data — skipping seed.")
            return

        print("Seeding users...")
        doctor_users = []
        for d in DOCTORS:
            user = User(name=d["name"], email=d["email"],
                        hashed_password=hash_password(d["password"]), role=Role.DOCTOR)
            db.add(user)
            doctor_users.append(user)

        patient_users = []
        for p in PATIENTS:
            user = User(name=p["name"], email=p["email"],
                        hashed_password=hash_password(p["password"]), role=Role.PATIENT)
            db.add(user)
            patient_users.append(user)

        db.flush()  # assigns IDs without committing

        print("Seeding slots...")
        all_slots = []
        for doctor in doctor_users:
            for day_offset, hour, duration in SLOT_TEMPLATES:
                start, end = make_slot_times(day_offset, hour, duration)
                slot = Slot(doctor_id=doctor.id, start_time=start, end_time=end,
                            duration_minutes=duration, max_patients=1, is_available=True)
                db.add(slot)
                all_slots.append((doctor, slot))

        db.flush()

        print("Seeding appointments...")
        # Arjun books slot 0 of doctor 0 → APPROVED
        appt1 = Appointment(patient_id=patient_users[0].id,
                            slot_id=all_slots[0][1].id,
                            status=AppointmentStatus.APPROVED)
        all_slots[0][1].is_available = False
        db.add(appt1)

        # Sneha books slot 1 of doctor 0 → PENDING
        appt2 = Appointment(patient_id=patient_users[1].id,
                            slot_id=all_slots[1][1].id,
                            status=AppointmentStatus.PENDING)
        all_slots[1][1].is_available = False
        db.add(appt2)

        # Kiran books slot 0 of doctor 1 → REJECTED
        appt3 = Appointment(patient_id=patient_users[2].id,
                            slot_id=all_slots[7][1].id,
                            status=AppointmentStatus.REJECTED)
        db.add(appt3)

        # Meera books slot 1 of doctor 1 → CANCELLED
        appt4 = Appointment(patient_id=patient_users[3].id,
                            slot_id=all_slots[8][1].id,
                            status=AppointmentStatus.CANCELLED)
        db.add(appt4)

        db.commit()

        print("\nSeed complete!")
        print("\n--- Doctor logins ---")
        for d in DOCTORS:
            print(f"  {d['email']}  /  {d['password']}")
        print("\n--- Patient logins ---")
        for p in PATIENTS:
            print(f"  {p['email']}  /  {p['password']}")

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed()
