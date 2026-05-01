# UniQueue - University Queue System

A modern React frontend for managing university service queues with real-time booking and staff management capabilities.

## Features

- **Student Portal**: Register, login, book appointments, view queue status
- **Staff Dashboard**: Manage queue operations, call next student, mark completed
- **Admin Analytics**: View daily metrics, service usage, performance data
- **Real-time Updates**: Connected to FastAPI backend for live data
- **Responsive Design**: Works on desktop and mobile devices
- **Offline Fallback**: Mock mode for demonstrations when backend is unavailable

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Custom CSS with warm gradient design
- **State Management**: React hooks with localStorage persistence
- **API**: RESTful integration with JWT authentication
- **Deployment**: Ready for Render.com static site hosting

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd advpm

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5176`

### Environment Variables

Create a `.env` file in the root directory:

```env
# Backend API URL
VITE_API_BASE_URL=https://advpm.onrender.com

# Optional: Force mock mode for offline demo
# VITE_FORCE_MOCK_MODE=false

# Optional: Use mock authentication
# VITE_USE_MOCK_AUTH=true
```

## Production Deployment

### Render.com Setup

1. **Connect Repository**: Link your GitHub repository to Render
2. **Build Settings**:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Root Directory**: (leave empty)
3. **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://advpm.onrender.com`
4. **Deploy**: Render will automatically build and deploy on git push

### Manual Build

```bash
# Build for production
npm run build

# The dist/ folder contains the production build
# Serve the dist/ folder with any static hosting service
```

## API Integration

The frontend connects to a FastAPI backend with the following endpoints:

- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication (returns JWT)
- `GET /api/timeslots/available` - Get available time slots
- `GET /api/bookings` - Get user bookings
- `POST /api/bookings` - Create new booking
- `DELETE /api/bookings/{id}` - Cancel booking
- `GET /health` - Health check

All authenticated requests include `Authorization: Bearer <token>` header.

## Project Structure

```
src/
├── components/          # Reusable UI components
├── config/
│   └── api.ts          # API configuration and utilities
├── App.tsx             # Main application component
├── App.css             # Main styles
├── main.tsx           # Application entry point
└── index.css          # Global styles
```

## Features Overview

### Student Features
- SDU email registration and login
- Service selection with descriptions
- Time slot booking with date selection
- Booking management (view, cancel, reschedule)
- Queue status monitoring

### Staff Features
- Queue management dashboard
- Call next student functionality
- Mark bookings as completed or absent
- Real-time queue status

### Admin Features
- Analytics dashboard with metrics
- Service usage statistics
- Performance monitoring
- Daily booking summaries

## Development Notes

- Uses mock data fallback when backend is unavailable
- JWT tokens are stored in localStorage for session persistence
- Responsive design works on all screen sizes
- TypeScript for type safety
- Clean, maintainable code with comments for presentation

## License

This project is part of a university final project demonstration.
