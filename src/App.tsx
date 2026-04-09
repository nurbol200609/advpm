import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Booking = {
  id: string
  name: string
  studentId: string
  slot: string
  createdAt?: string
}

type View = 'home' | 'timeslots' | 'booking' | 'bookings' | 'health' | 'login' | 'register'

type MockUser = {
  fullName: string
  email: string
  password: string
}

type AuthUser = {
  fullName: string
  email: string
}

const API = {
  timeslots: '/timeslots',
  bookings: '/bookings',
  health: '/health',
}

const USE_MOCK_API = true
const MOCK_DELAY_MS = 250
const MOCK_USERS_KEY = 'uqs-mock-users'
const MOCK_BOOKINGS_KEY = 'uqs-mock-bookings'

const fetchJson = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const generateTimeSlots = () => {
  const slots: string[] = []
  for (let hour = 9; hour <= 18; hour += 1) {
    for (let minute = 0; minute < 60; minute += 10) {
      if (hour === 18 && minute > 0) {
        break
      }
      const formattedHour = String(hour).padStart(2, '0')
      const formattedMinute = String(minute).padStart(2, '0')
      slots.push(`${formattedHour}:${formattedMinute}`)
    }
  }
  return slots
}

const validateSduEmail = (email: string) => /^[a-z0-9._%+-]+@sdu\.edu\.kz$/i.test(email.trim())

const loadMockUsers = (): MockUser[] => {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(MOCK_USERS_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveMockUsers = (users: MockUser[]) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
  }
}

const loadMockBookings = (): Booking[] => {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(MOCK_BOOKINGS_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveMockBookings = (bookings: Booking[]) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(bookings))
  }
}

const buildMockBooking = (name: string, studentId: string, slot: string): Booking => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    name,
    studentId,
    slot,
    createdAt: new Date().toLocaleString('en-US'),
  }
}

function App() {
  const [view, setView] = useState<View>('home')
  const [slots, setSlots] = useState<string[]>([])
  const [bookings, setBookings] = useState<Booking[]>(() => loadMockBookings())
  const [health, setHealth] = useState<string>('Not checked yet')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mockUsers, setMockUsers] = useState<MockUser[]>(() => loadMockUsers())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (USE_MOCK_API) {
      saveMockBookings(bookings)
    }
  }, [bookings])

  useEffect(() => {
    setMessage(null)
    if (view === 'timeslots' || view === 'booking') {
      loadSlots()
    }
    if (view === 'bookings') {
      loadBookings()
    }
    if (view === 'health') {
      checkHealth()
    }
  }, [view])

  const loadSlots = async () => {
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const mockSlots = generateTimeSlots()
        setSlots(mockSlots)
        setSelectedSlot((current) => current || mockSlots[0] || '')
        return
      }

      const data = await fetchJson(API.timeslots)
      const remoteSlots = Array.isArray(data) ? data : data.slots || []
      const finalSlots = remoteSlots.length ? remoteSlots : generateTimeSlots()
      setSlots(finalSlots)
      setSelectedSlot((current) => current || finalSlots[0] || '')
    } catch {
      setMessage('Could not fetch time slots. Falling back to default schedule.')
      const fallbackSlots = generateTimeSlots()
      setSlots(fallbackSlots)
      setSelectedSlot((current) => current || fallbackSlots[0] || '')
    } finally {
      setLoading(false)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        return
      }

      const data = await fetchJson(API.bookings)
      setBookings(Array.isArray(data) ? data : data.bookings || [])
    } catch {
      setMessage('Could not fetch bookings. Please check the backend.')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        setHealth('Mock mode active. Backend is not connected yet.')
        return
      }

      const data = await fetchJson(API.health)
      setHealth(typeof data === 'string' ? data : data.status || 'OK')
    } catch {
      setMessage('Could not check server health.')
      setHealth('Server is unavailable')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = registerEmail.trim().toLowerCase()

    if (!registerName.trim()) {
      setMessage('Please enter your full name.')
      return
    }

    if (!validateSduEmail(normalizedEmail)) {
      setMessage('Only SDU email is allowed (example: your.name@sdu.edu.kz).')
      return
    }

    if (registerPassword.trim().length < 6) {
      setMessage('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const exists = mockUsers.some((user) => user.email === normalizedEmail)
        if (exists) {
          setMessage('This email is already registered. Please login.')
          return
        }

        const newUser: MockUser = {
          fullName: registerName.trim(),
          email: normalizedEmail,
          password: registerPassword.trim(),
        }
        const updatedUsers = [...mockUsers, newUser]
        setMockUsers(updatedUsers)
        saveMockUsers(updatedUsers)
        setCurrentUser({ fullName: newUser.fullName, email: newUser.email })
        setRegisterName('')
        setRegisterEmail('')
        setRegisterPassword('')
        setMessage('Registration successful in mock mode.')
        setView('home')
        return
      }

      await fetchJson('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: registerName.trim(),
          email: normalizedEmail,
          password: registerPassword.trim(),
        }),
      })

      setMessage('Registration successful. Please login.')
      setView('login')
    } catch {
      setMessage('Could not register user.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = loginEmail.trim().toLowerCase()

    if (!validateSduEmail(normalizedEmail)) {
      setMessage('Login is allowed only with @sdu.edu.kz email.')
      return
    }

    if (!loginPassword.trim()) {
      setMessage('Please enter your password.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const existingUser = mockUsers.find(
          (user) => user.email === normalizedEmail && user.password === loginPassword.trim(),
        )

        if (!existingUser) {
          setMessage('Invalid credentials. Try again or register first.')
          return
        }

        setCurrentUser({ fullName: existingUser.fullName, email: existingUser.email })
        setLoginEmail('')
        setLoginPassword('')
        setMessage('Logged in successfully (mock mode).')
        setView('home')
        return
      }

      const user = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password: loginPassword.trim(),
        }),
      })

      setCurrentUser({ fullName: user.fullName || 'Student', email: normalizedEmail })
      setMessage('Logged in successfully.')
      setView('home')
    } catch {
      setMessage('Could not login user.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setMessage('You have been logged out.')
  }

  const handleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedSlot || !name.trim() || !studentId.trim()) {
      setMessage('Please provide full name, student ID, and a time slot.')
      return
    }

    if (!currentUser) {
      setMessage('Please login first using your SDU email.')
      setView('login')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const newBooking = buildMockBooking(name.trim(), studentId.trim(), selectedSlot)
        setBookings((current) => [...current, newBooking])
        setName('')
        setStudentId('')
        setMessage('Booking created in mock mode.')
        setView('bookings')
        return
      }

      const newBooking = await fetchJson(API.bookings, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          studentId: studentId.trim(),
          slot: selectedSlot,
        }),
      })

      setBookings((current) => [...current, newBooking])
      setName('')
      setStudentId('')
      setMessage('Booking created successfully!')
      setView('bookings')
    } catch {
      setMessage('Could not create booking.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        setBookings((current) => current.filter((booking) => booking.id !== id))
        setMessage('Booking canceled in mock mode.')
        return
      }

      await fetchJson(`${API.bookings}/${id}`, { method: 'DELETE' })
      setBookings((current) => current.filter((booking) => booking.id !== id))
      setMessage('Booking canceled.')
    } catch {
      setMessage('Could not cancel booking.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />

      <header className="hero">
        <h1>University Queue System</h1>
        <p>Alpha Build: queue booking for students with secure SDU email access.</p>
        {USE_MOCK_API && (
          <p className="subtle-text">
            Mock mode is ON. All actions are simulated in UI only.
          </p>
        )}
      </header>

      <div className="top-row">
        {currentUser ? (
          <div className="user-pill">
            Logged in as <strong>{currentUser.fullName}</strong> ({currentUser.email})
          </div>
        ) : (
          <div className="user-pill">Not logged in</div>
        )}

        {currentUser && (
          <button type="button" className="btn btn-outline" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>

      <div className="nav-grid">
        {[
          { label: 'Home', value: 'home' },
          { label: 'Register', value: 'register' },
          { label: 'Login', value: 'login' },
          { label: 'Time Slots', value: 'timeslots' },
          { label: 'Booking', value: 'booking' },
          { label: 'Bookings', value: 'bookings' },
          { label: 'Health Check', value: 'health' },
        ].map((button) => (
          <button
            key={button.value}
            type="button"
            onClick={() => setView(button.value as View)}
            className={`btn ${view === button.value ? 'btn-active' : 'btn-outline'}`}
          >
            {button.label}
          </button>
        ))}
      </div>

      {loading && <div className="notice loading">Loading...</div>}
      {message && <div className="notice">{message}</div>}

      {view === 'home' && (
        <section className="panel">
          <h2>Home</h2>
          <p>Welcome to the alpha version of the SDU queue booking platform.</p>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Strict SDU Auth</h3>
              <p>Registration and login accept only emails ending with @sdu.edu.kz.</p>
            </div>
            <div className="feature-card">
              <h3>Student ID Booking</h3>
              <p>Every booking now includes student ID for backend-ready data integrity.</p>
            </div>
            <div className="feature-card">
              <h3>Health Check</h3>
              <p>Use it to see if backend API is reachable before trying real requests.</p>
            </div>
          </div>
        </section>
      )}

      {view === 'register' && (
        <section className="panel">
          <h2>Register</h2>
          <form onSubmit={handleRegister} className="form-grid">
            <label>
              Full name
              <input
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="Enter your full name"
                className="field"
              />
            </label>
            <label>
              SDU email
              <input
                type="email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                placeholder="name@sdu.edu.kz"
                className="field"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                className="field"
              />
            </label>
            <button type="submit" className="btn btn-active">Create account</button>
          </form>
        </section>
      )}

      {view === 'login' && (
        <section className="panel">
          <h2>Login</h2>
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              SDU email
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="name@sdu.edu.kz"
                className="field"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Enter your password"
                className="field"
              />
            </label>
            <button type="submit" className="btn btn-active">Sign in</button>
          </form>
        </section>
      )}

      {view === 'timeslots' && (
        <section className="panel">
          <h2>Available Time Slots</h2>
          <p>This page shows the available booking time slots.</p>
          <button type="button" onClick={loadSlots} className="btn btn-outline">
            Refresh slots
          </button>
          <div className="slot-grid">
            {slots.map((slot) => (
              <div key={slot} className="slot-card">
                {slot}
              </div>
            ))}
            {slots.length === 0 && <div>No slots found.</div>}
          </div>
        </section>
      )}

      {view === 'booking' && (
        <section className="panel">
          <h2>Booking Form</h2>
          <form onSubmit={handleBooking} className="form-grid">
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="field"
              />
            </label>

            <label>
              Student ID
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="e.g. 23B030123"
                className="field"
              />
            </label>

            <label>
              Select slot
              <select
                value={selectedSlot}
                onChange={(event) => setSelectedSlot(event.target.value)}
                className="field"
              >
                <option value="" disabled>
                  Choose a time
                </option>
                {slots.length === 0 && <option value="">No available slots</option>}
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn btn-active">
              Book
            </button>
          </form>
          {!currentUser && (
            <p className="subtle-text">Tip: login with your SDU email to create bookings.</p>
          )}
        </section>
      )}

      {view === 'bookings' && (
        <section className="panel">
          <h2>Booking List</h2>
          <button type="button" onClick={loadBookings} className="btn btn-outline">
            Refresh list
          </button>
          <div className="list-grid">
            {bookings.length === 0 && <div>No bookings yet.</div>}
            {bookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-meta">
                  <strong>{booking.name}</strong>
                  <div>Student ID: {booking.studentId}</div>
                  <div>Slot: {booking.slot}</div>
                  {booking.createdAt && <div>Date: {booking.createdAt}</div>}
                </div>
                <button type="button" onClick={() => handleCancel(booking.id)} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'health' && (
        <section className="panel">
          <h2>Server Health</h2>
          <p>Status: <strong>{health}</strong></p>
          <p className="subtle-text">
            Health endpoint helps frontend quickly detect whether backend is up before real booking calls.
          </p>
          <button type="button" onClick={checkHealth} className="btn btn-outline">
            Refresh status
          </button>
        </section>
      )}
    </div>
  )
}

export default App
