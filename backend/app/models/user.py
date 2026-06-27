import enum

from sqlalchemy import Column, Enum, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Role(str, enum.Enum):
    PATIENT = "PATIENT"
    DOCTOR = "DOCTOR"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(Role), nullable=False)

    # Doctor's created slots
    slots = relationship("Slot", back_populates="doctor", foreign_keys="Slot.doctor_id")

    # Patient's booked appointments
    appointments = relationship("Appointment", back_populates="patient", foreign_keys="Appointment.patient_id")
