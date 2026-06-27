from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, doctors, patients

app = FastAPI(title="Clinical Appointment Portal", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(doctors.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
