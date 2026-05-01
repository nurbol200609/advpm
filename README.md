# CampusFlow

CampusFlow is a university queue and booking system for SDU campus services. Students can reserve service time slots, staff can manage the live queue, and admins can manage slots, staff accounts, and booking activity.

Live frontend:

```text
https://campusflow-frontend-llmh.onrender.com
```

Live backend:

```text
https://campusflow-backend-ra0h.onrender.com
```

## Team

| Member | Email | Responsibility |
| --- | --- | --- |
| Bexulton Shovkatboyev | 230103294@sdu.edu.kz | Backend |
| Zhakyp Nurbol | 230103152@sdu.edu.kz | Frontend |
| Kaldybay Bakdaulet | 230103156@sdu.edu.kz | Project management |

## Features

- JWT authentication with `student`, `staff`, and `admin` roles
- Student registration and login
- Service slot browsing for cafe, library, and deanery
- Student booking creation and cancellation
- Student profile with editable personal info and profile photo
- Staff queue dashboard with "served" action
- Staff view of all bookings
- Admin slot creation, editing, and deletion
- Admin creation of staff/admin accounts
- Admin booking analytics overview
- Responsive React UI with SDU campus visual styling

## Tech Stack

Frontend:

- React 19
- TypeScript
- Vite
- CSS

Backend:

- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT authentication
- Render deployment

## User Roles

| Feature | Student | Staff | Admin |
| --- | --- | --- | --- |
| Register account | Yes | No | No |
| Login | Yes | Yes | Yes |
| View service slots | Yes | No | Yes |
| Create booking | Yes | No | No |
| View own bookings | Yes | No | No |
| View service queue | No | Yes | Yes |
| Mark booking as served | No | Yes | Yes |
| View all bookings | No | Yes | Yes |
| Create/edit/delete slots | No | No | Yes |
| Create staff/admin | No | No | Yes |
| View analytics | No | No | Yes |

## API Overview

Authentication:

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register student, or create staff/admin as admin |
| `POST` | `/api/auth/login` | Login and receive JWT token |

Timeslots:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/timeslots/available?service_type=cafe` | Get available slots |
| `POST` | `/api/timeslots/` | Create slot, admin only |
| `PUT` | `/api/timeslots/{slot_id}` | Update slot, admin only |
| `DELETE` | `/api/timeslots/{slot_id}` | Disable slot, admin only |

Bookings:

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/bookings` | Create student booking |
| `GET` | `/api/bookings/my` | Get current student's bookings |
| `DELETE` | `/api/bookings/{booking_id}` | Cancel booking |
| `GET` | `/api/bookings/all` | Get all bookings, staff/admin |
| `GET` | `/api/bookings/queue/{service_type}` | Get live queue, staff/admin |
| `POST` | `/api/bookings/serve/{booking_id}` | Mark booking as served, staff/admin |

## Frontend Setup

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Backend Setup

Create and activate virtual environment:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `.env` inside `backend/`:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

Run backend locally:

```bash
python run.py
```

Local backend URL:

```text
http://127.0.0.1:8000
```

## Main User Flow

1. Student registers with SDU email.
2. Student logs in and receives JWT token.
3. Student selects a service: cafe, library, or deanery.
4. Student books an available slot.
5. Staff sees the student in the live queue.
6. Staff marks the booking as served.
7. Admin can manage slots, staff/admin accounts, and booking statistics.

## Notes

- Student profile data and uploaded profile photo are stored in browser `localStorage`.
- Backend stores users, timeslots, and bookings in the database.
- Slot deletion is implemented as a soft delete by setting `is_active = false`.
- Slots with active bookings cannot be deleted until bookings are completed or cancelled.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check and build frontend |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |
