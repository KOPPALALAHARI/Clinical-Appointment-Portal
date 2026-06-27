# Clinical Appointment Portal

A full-stack web application where patients can book appointments with doctors, and doctors can manage appointment slots and requests.

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React.js (Create React App), CSS Modules     |
| Backend    | Python 3.11 + FastAPI                        |
| Database   | PostgreSQL 14+                               |
| Auth       | JWT access tokens + refresh token rotation   |
| ORM        | SQLAlchemy 2.0                               |
| Migrations | Alembic                                      |

---

## Project Structure

```
Clinical-Appointment-Portal/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers (auth, patients, doctors)
│   │   ├── core/         # Config, database, security helpers
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Auth dependency injection
│   │   └── main.py       # FastAPI app entry point
│   ├── migrations/       # Alembic migration files
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── api/          # Axios API client modules
        ├── components/   # Navbar, PrivateRoute
        ├── context/      # AuthContext (JWT + refresh token storage)
        └── pages/        # Auth, Patient, Doctor pages
```

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### 1. Database

```sql
CREATE DATABASE clinical_portal;
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and a strong SECRET_KEY

# Run all database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

React app: `http://localhost:3000`

---

## API Endpoints

### Authentication

| Method | Endpoint           | Auth | Description                             |
|--------|--------------------|------|-----------------------------------------|
| POST   | /api/auth/register | No   | Register a new user                     |
| POST   | /api/auth/login    | No   | Login — returns access + refresh token  |
| POST   | /api/auth/refresh  | No   | Rotate refresh token, get a new pair    |
| POST   | /api/auth/logout   | Yes  | Revoke the current refresh token        |

**Register body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "secret123",
  "role": "PATIENT"
}
```

**Login response:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque-token>",
  "token_type": "bearer",
  "user": { "id": 1, "name": "Jane Smith", "email": "...", "role": "PATIENT" }
}
```

---

### Patient Endpoints *(Bearer token, PATIENT role)*

| Method | Endpoint                                | Description                         |
|--------|-----------------------------------------|-------------------------------------|
| GET    | /api/patients/doctors                   | List all registered doctors         |
| GET    | /api/patients/doctors/{doctor_id}/slots | View available slots for a doctor   |
| POST   | /api/patients/appointments              | Book an available slot              |
| GET    | /api/patients/appointments              | View own appointments               |
| PATCH  | /api/patients/appointments/{id}/cancel  | Cancel a PENDING appointment        |

**Book appointment body:** `{ "slot_id": 5 }`

---

### Doctor Endpoints *(Bearer token, DOCTOR role)*

| Method | Endpoint                              | Description                           |
|--------|---------------------------------------|---------------------------------------|
| POST   | /api/doctors/slots                    | Create a single slot                  |
| POST   | /api/doctors/slots/bulk               | Bulk-generate slots over a date range |
| GET    | /api/doctors/slots                    | List own slots with booking counts    |
| GET    | /api/doctors/appointments             | View all appointment requests         |
| PATCH  | /api/doctors/appointments/{id}/status | Approve or Reject an appointment      |

**Bulk slot creation body:**
```json
{
  "date_from": "2026-07-01",
  "date_to": "2026-07-05",
  "from_time": "09:00:00",
  "to_time": "17:00:00",
  "duration_minutes": 30,
  "max_patients": 2
}
```
Generates a slot every 30 minutes from 09:00–17:00 on each day Jul 1–5 (16 slots/day × 5 days = 80 slots).

**Update status body:** `{ "status": "APPROVED" }` or `{ "status": "REJECTED" }`

---

## Business Rules

| Rule | Detail |
|------|--------|
| Appointment flow | `PENDING` → `APPROVED` or `REJECTED`; patient can `CANCEL` while `PENDING` |
| No reverse transitions | Cannot approve a `REJECTED` appointment or reject an `APPROVED` one |
| Cancelled immutable | A `CANCELLED` appointment cannot be approved or rejected |
| Multi-patient slots | A slot stays available until `booked_count >= max_patients` |
| No duplicate booking | A patient cannot book the same slot twice |
| Slot restoration | Cancelling or rejecting restores slot availability if capacity opens up |

All rules are enforced at the API layer.

---

## Database Schema

```
users
  id                PK
  name              VARCHAR
  email             VARCHAR UNIQUE
  hashed_password   VARCHAR
  role              ENUM(PATIENT, DOCTOR)

refresh_tokens
  id                PK
  token             VARCHAR UNIQUE
  user_id           FK → users.id
  revoked           BOOLEAN DEFAULT false
  created_at        TIMESTAMPTZ
  expires_at        TIMESTAMPTZ

slots
  id                PK
  doctor_id         FK → users.id
  start_time        TIMESTAMPTZ
  end_time          TIMESTAMPTZ
  duration_minutes  INTEGER DEFAULT 30
  max_patients      INTEGER DEFAULT 1
  is_available      BOOLEAN DEFAULT true

appointments
  id                PK
  patient_id        FK → users.id
  slot_id           FK → slots.id   ← no unique constraint (multi-patient support)
  status            ENUM(PENDING, APPROVED, REJECTED, CANCELLED)
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ
```

---

## Design Decisions

**JWT + refresh token rotation** — Short-lived access tokens (30 min) are paired with long-lived refresh tokens (7 days) stored in the `refresh_tokens` table. On each refresh the old token is revoked and a new pair is issued, enabling instant logout and detection of token reuse.

**Role-based access via JWT claims** — The JWT payload carries `sub` (user ID) and `role`. A `require_role()` FastAPI dependency enforces role separation without polluting business logic.

**`is_available` flag** — Slot availability is stored as a boolean flag rather than computed from appointments at query time. It flips to `false` when active bookings reach `max_patients`, and back to `true` when a booking is cancelled or rejected and capacity opens up.

**Multi-patient slots** — Removing the `UNIQUE` constraint on `appointments.slot_id` allows multiple patients to share a slot up to `max_patients`. Capacity is enforced in the API; duplicate bookings by the same patient are blocked.

**Bulk slot generation** — Doctors provide a date range, a daily time window, and a slot duration. The backend generates all slots automatically.

**Alembic migrations** — Schema changes are managed via versioned migration files under `migrations/versions/`. Apply all: `alembic upgrade head`. Generate a new migration after changing a model: `alembic revision --autogenerate -m "describe_change"`.

**Frontend auto-refresh** — The Axios interceptor catches `401` responses, queues in-flight requests, silently refreshes the access token, then replays the queued requests. If the refresh also fails, the user is redirected to login.
