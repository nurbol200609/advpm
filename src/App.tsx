import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type BookingStatus = 'Confirmed' | 'Pending' | 'Completed'

type Booking = {
  id: string
  name: string
  studentId: string
  slot: string
  createdAt?: string
  queueNumber?: string
  status?: BookingStatus
}

type View = 'home' | 'timeslots' | 'booking' | 'bookings' | 'health' | 'login' | 'register'
type SlotFilter = 'all' | 'morning' | 'afternoon' | 'evening'

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

const findFirstFreeSlot = (slotList: string[], currentBookings: Booking[]) => {
  const occupied = new Set(currentBookings.map((booking) => booking.slot))
  return slotList.find((slot) => !occupied.has(slot)) || ''
}

const validateSduEmail = (email: string) => /^[a-z0-9._%+-]+@sdu\.edu\.kz$/i.test(email.trim())
const validateStudentId = (id: string) => /^[a-zA-Z0-9-]{5,20}$/.test(id.trim())

const getSlotPeriod = (slot: string): Exclude<SlotFilter, 'all'> => {
  const hour = Number(slot.split(':')[0])
  if (hour < 12) {
    return 'morning'
  }
  if (hour < 16) {
    return 'afternoon'
  }
  return 'evening'
}

const toStatus = (value?: string): BookingStatus => {
  if (value === 'Pending' || value === 'Completed') {
    return value
  }
  return 'Confirmed'
}

const generateQueueNumber = (count: number) => `UQ-${String(count + 1).padStart(3, '0')}`

const normalizeBooking = (booking: Booking, index: number): Booking => ({
  ...booking,
  queueNumber: booking.queueNumber || generateQueueNumber(index),
  status: toStatus(booking.status),
})

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
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((booking, index) => normalizeBooking(booking, index))
  } catch {
    return []
  }
}

const saveMockBookings = (bookings: Booking[]) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(bookings))
  }
}

const buildMockBooking = (name: string, studentId: string, slot: string, count: number): Booking => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    name,
    studentId,
    slot,
    createdAt: new Date().toLocaleString('en-US'),
    queueNumber: generateQueueNumber(count),
    status: 'Confirmed',
  }
}

function Icon({ name }: { name: string }) {
  const map: Record<string, string> = {
    welcome: '🎓',
    slots: '🕒',
    booking: '📝',
    queue: '🔢',
    health: '🩺',
    analytics: '📊',
    food: '🍽️',
    check: '✅',
    alert: '⚠️',
    user: '👤',
  }

  return <span aria-hidden="true" className="icon-mark">{map[name] || '•'}</span>
}

function StatusPill({ label, tone = 'neutral' }: { label: string, tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  return <span className={`status-pill tone-${tone}`}>{label}</span>
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="section-actions">{right}</div>}
    </div>
  )
}

function StatCard({ title, value, helper, icon }: { title: string, value: string, helper?: string, icon: string }) {
  return (
    <article className="stat-card">
      <div className="stat-icon"><Icon name={icon} /></div>
      <div className="stat-content">
        <p>{title}</p>
        <h3>{value}</h3>
        {helper && <small>{helper}</small>}
      </div>
    </article>
  )
}

function FeatureCard({ title, description, icon }: { title: string, description: string, icon: string }) {
  return (
    <article className="feature-card">
      <div className="feature-top">
        <Icon name={icon} />
        <h3>{title}</h3>
      </div>
      <p>{description}</p>
    </article>
  )
}

function EmptyState({ title, description, action }: { title: string, description: string, action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name="queue" /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('login')
  const [slots, setSlots] = useState<string[]>(() => generateTimeSlots())
  const [bookings, setBookings] = useState<Booking[]>(() => loadMockBookings())
  const [health, setHealth] = useState<string>('Not checked yet')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all')
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('Not checked yet')
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)

  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mockUsers, setMockUsers] = useState<MockUser[]>(() => loadMockUsers())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  const [bookingFieldErrors, setBookingFieldErrors] = useState<{ name?: string, studentId?: string, slot?: string }>({})

  const authViews: View[] = ['login', 'register']

  useEffect(() => {
    if (USE_MOCK_API) {
      saveMockBookings(bookings)
    }
  }, [bookings])

  useEffect(() => {
    setMessage(null)

    if (!currentUser && !authViews.includes(view)) {
      setView('login')
      return
    }

    if (view === 'timeslots' || view === 'booking') {
      void loadSlots()
    }
    if (view === 'bookings') {
      void loadBookings()
    }
    if (view === 'health') {
      void checkHealth()
    }
  }, [view])

  useEffect(() => {
    if (currentUser) {
      setName((prev) => prev || currentUser.fullName)
    }
  }, [currentUser])

  const loadSlots = async () => {
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const mockSlots = generateTimeSlots()
        setSlots(mockSlots)
        setSelectedSlot((current) => current || findFirstFreeSlot(mockSlots, bookings))
        return
      }

      const data = await fetchJson(API.timeslots)
      const remoteSlots = Array.isArray(data) ? data : data.slots || []
      const finalSlots = remoteSlots.length ? remoteSlots : generateTimeSlots()
      setSlots(finalSlots)
      setSelectedSlot((current) => current || findFirstFreeSlot(finalSlots, bookings))
    } catch {
      setMessage('Could not fetch time slots. Falling back to default schedule.')
      const fallbackSlots = generateTimeSlots()
      setSlots(fallbackSlots)
      setSelectedSlot((current) => current || findFirstFreeSlot(fallbackSlots, bookings))
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
      const incoming = (Array.isArray(data) ? data : data.bookings || []) as Booking[]
      setBookings(incoming.map((booking, index) => normalizeBooking(booking, index)))
    } catch {
      setMessage('Could not fetch bookings. Please check the backend.')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    const startedAt = performance.now()
    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        setHealth('Mock mode active. Backend is not connected yet.')
        setHealthLatencyMs(Math.round(performance.now() - startedAt))
        setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
        return
      }

      const data = await fetchJson(API.health)
      setHealth(typeof data === 'string' ? data : data.status || 'OK')
      setHealthLatencyMs(Math.round(performance.now() - startedAt))
      setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
    } catch {
      setMessage('Could not check server health.')
      setHealth('Server is unavailable')
      setHealthLatencyMs(Math.round(performance.now() - startedAt))
      setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = registerEmail.trim().toLowerCase()
    const normalizedPassword = registerPassword.trim()

    if (!registerName.trim()) {
      setMessage('Please enter your full name.')
      return
    }

    if (!validateSduEmail(normalizedEmail)) {
      setMessage('Only SDU email is allowed (example: your.name@sdu.edu.kz).')
      return
    }

    if (normalizedPassword.length < 6) {
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
          password: normalizedPassword,
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
          password: normalizedPassword,
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
    const normalizedPassword = loginPassword.trim()

    if (!validateSduEmail(normalizedEmail)) {
      setMessage('Login is allowed only with @sdu.edu.kz email.')
      return
    }

    if (!normalizedPassword) {
      setMessage('Please enter your password.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        const existingUser = mockUsers.find(
          (user) => user.email === normalizedEmail && user.password === normalizedPassword,
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
          password: normalizedPassword,
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
    setView('login')
  }

  const handleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: { name?: string, studentId?: string, slot?: string } = {}

    if (!name.trim()) {
      nextErrors.name = 'Full name is required.'
    }
    if (!validateStudentId(studentId)) {
      nextErrors.studentId = 'Use a valid student ID (5-20 characters).'
    }
    if (!selectedSlot) {
      nextErrors.slot = 'Choose a slot first.'
    }

    const occupiedByOtherBooking = bookings.some(
      (booking) => booking.slot === selectedSlot && booking.id !== editingBookingId,
    )
    if (selectedSlot && occupiedByOtherBooking) {
      nextErrors.slot = 'This slot is already occupied. Choose another slot.'
    }

    setBookingFieldErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setMessage('Please fix highlighted fields before confirming booking.')
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
        if (editingBookingId) {
          setBookings((current) => current.map((booking) => (
            booking.id === editingBookingId
              ? {
                  ...booking,
                  name: name.trim(),
                  studentId: studentId.trim(),
                  slot: selectedSlot,
                  status: 'Confirmed',
                }
              : booking
          )))
          setEditingBookingId(null)
          setName(currentUser.fullName)
          setStudentId('')
          setMessage('Booking rescheduled successfully in mock mode.')
          setView('bookings')
          return
        }

        const newBooking = buildMockBooking(name.trim(), studentId.trim(), selectedSlot, bookings.length)
        setBookings((current) => [...current, newBooking])
        setEditingBookingId(null)
        setName(currentUser.fullName)
        setStudentId('')
        setMessage(`Booking confirmed in mock mode. Queue number: ${newBooking.queueNumber}`)
        setView('bookings')
        return
      }

      if (editingBookingId) {
        setBookings((current) => current.map((booking) => (
          booking.id === editingBookingId
            ? {
                ...booking,
                name: name.trim(),
                studentId: studentId.trim(),
                slot: selectedSlot,
                status: 'Confirmed',
              }
            : booking
        )))
        setEditingBookingId(null)
        setStudentId('')
        setMessage('Booking rescheduled successfully.')
        setView('bookings')
        return
      }

      const created = await fetchJson(API.bookings, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          studentId: studentId.trim(),
          slot: selectedSlot,
        }),
      })

      const normalized = normalizeBooking(created as Booking, bookings.length)
      setBookings((current) => [...current, normalized])
      setEditingBookingId(null)
      setStudentId('')
      setMessage(`Booking created successfully. Queue number: ${normalized.queueNumber}`)
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
        if (editingBookingId === id) {
          setEditingBookingId(null)
          setSelectedSlot('')
        }
        setMessage('Booking canceled in mock mode.')
        return
      }

      await fetchJson(`${API.bookings}/${id}`, { method: 'DELETE' })
      setBookings((current) => current.filter((booking) => booking.id !== id))
      if (editingBookingId === id) {
        setEditingBookingId(null)
        setSelectedSlot('')
      }
      setMessage('Booking canceled.')
    } catch {
      setMessage('Could not cancel booking.')
    } finally {
      setLoading(false)
    }
  }

  const prepareReschedule = (booking: Booking) => {
    setEditingBookingId(booking.id)
    setName(booking.name)
    setStudentId(booking.studentId)
    setSelectedSlot(booking.slot)
    setView('booking')
    setMessage(`Reschedule mode: update details for ${booking.queueNumber}.`)
  }

  const availableSlots = useMemo(
    () => (slotFilter === 'all' ? slots : slots.filter((slot) => getSlotPeriod(slot) === slotFilter)),
    [slotFilter, slots],
  )

  const groupedSlots = useMemo(() => {
    const groups: Record<Exclude<SlotFilter, 'all'>, string[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    }

    availableSlots.forEach((slot) => {
      groups[getSlotPeriod(slot)].push(slot)
    })

    return groups
  }, [availableSlots])

  const occupiedSlots = useMemo(
    () => new Set(bookings.map((booking) => booking.slot)),
    [bookings],
  )

  const occupiedSlotsForBookingForm = useMemo(
    () => new Set(bookings.filter((booking) => booking.id !== editingBookingId).map((booking) => booking.slot)),
    [bookings, editingBookingId],
  )

  const nextAvailableSlot = useMemo(() => {
    const nextFreeSlot = slots.find((slot) => !occupiedSlots.has(slot))
    if (!nextFreeSlot) {
      return 'Unavailable'
    }
    return nextFreeSlot
  }, [occupiedSlots, slots])

  const activeBooking = useMemo(() => {
    if (!bookings.length) {
      return null
    }
    return bookings[bookings.length - 1]
  }, [bookings])

  const healthTone = health.toLowerCase().includes('unavailable') ? 'warning' : 'success'

  return (
    <div className="app-shell">
      <div className="bg-accent bg-accent-one" />
      <div className="bg-accent bg-accent-two" />

      <header className="hero-card">
        <div className="hero-main">
          <div className="hero-title-wrap">
            <span className="hero-kicker">UniQueue Platform</span>
            <h1>University Queue System</h1>
            <p>
              Smart booking and queue operations for campus services with a clean, student-first experience.
            </p>
          </div>

          <div className="hero-badges">
            <StatusPill label={USE_MOCK_API ? 'Mock Mode Active' : 'Live API Mode'} tone={USE_MOCK_API ? 'info' : 'success'} />
            <StatusPill label={health} tone={healthTone} />
          </div>
        </div>

        <div className="hero-user-row">
          {currentUser ? (
            <div className="user-pill">
              <Icon name="user" />
              <span>
                <strong>{currentUser.fullName}</strong>
                <small>{currentUser.email}</small>
              </span>
            </div>
          ) : (
            <div className="user-pill guest-pill">
              <Icon name="alert" />
              <span>Not logged in</span>
            </div>
          )}

          {currentUser && (
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </header>

      <nav className="tab-nav" aria-label="Primary navigation">
        {(currentUser
          ? [
              { label: 'Home', value: 'home' },
              { label: 'Time Slots', value: 'timeslots' },
              { label: 'Booking', value: 'booking' },
              { label: 'Bookings', value: 'bookings' },
              { label: 'Health Check', value: 'health' },
            ]
          : [
              { label: 'Register', value: 'register' },
              { label: 'Login', value: 'login' },
            ]
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setView(tab.value as View)}
            className={`btn ${view === tab.value ? 'btn-primary' : 'btn-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loading && <div className="alert-banner">Loading latest data...</div>}
      {message && <div className="alert-banner muted">{message}</div>}

      {!currentUser && (
        <section className="surface-card auth-welcome">
          <SectionHeader
            title="Welcome to UniQueue"
            subtitle="Use your SDU email account to continue."
          />

          <div className="chip-row">
            <StatusPill label="@sdu.edu.kz only" tone="info" />
            <StatusPill label="Student ID required for booking" tone="neutral" />
            <StatusPill label="Queue number assigned instantly" tone="success" />
          </div>

          <div className="auth-grid">
            {view === 'register' && (
              <form onSubmit={handleRegister} className="surface-card form-card" aria-label="Register form">
                <SectionHeader title="Register" subtitle="Create your student account" />

                <label className="field-block">
                  <span>Full name</span>
                  <input
                    value={registerName}
                    onChange={(event) => setRegisterName(event.target.value)}
                    placeholder="Enter your full name"
                    className="field"
                  />
                </label>

                <label className="field-block">
                  <span>SDU email</span>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="name@sdu.edu.kz"
                    className="field"
                  />
                </label>

                <label className="field-block">
                  <span>Password</span>
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                    className="field"
                  />
                </label>

                <button type="submit" className="btn btn-primary">Create account</button>
              </form>
            )}

            {view === 'login' && (
              <form onSubmit={handleLogin} className="surface-card form-card" aria-label="Login form">
                <SectionHeader title="Login" subtitle="Sign in to access bookings" />

                <label className="field-block">
                  <span>SDU email</span>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="name@sdu.edu.kz"
                    className="field"
                  />
                </label>

                <label className="field-block">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="field"
                  />
                </label>

                <button type="submit" className="btn btn-primary">Sign in</button>
              </form>
            )}

            <aside className="surface-card mini-roadmap">
              <SectionHeader title="Alpha Highlights" subtitle="What this build already demonstrates" />
              <ul>
                <li>Slot-based booking for university services</li>
                <li>Digital queue number assignment</li>
                <li>Real-time style service-health panel</li>
                <li>Mock-mode fallback for offline demos</li>
              </ul>
            </aside>
          </div>
        </section>
      )}

      {currentUser && view === 'home' && (
        <section className="surface-card">
          <SectionHeader
            title={`Welcome back, ${currentUser.fullName.split(' ')[0]}`}
            subtitle="Monitor service load, booking readiness, and queue activity from one place."
          />

          <div className="stats-grid">
            <StatCard title="Available slots today" value={String(slots.length)} helper="09:00-18:00 schedule" icon="slots" />
            <StatCard title="Next available slot" value={nextAvailableSlot} helper="Tap booking to reserve" icon="booking" />
            <StatCard
              title="Active booking"
              value={activeBooking ? activeBooking.queueNumber || 'Ready' : 'None'}
              helper={activeBooking ? `${activeBooking.name} at ${activeBooking.slot}` : 'Create your first booking'}
              icon="queue"
            />
            <StatCard
              title="System health"
              value={healthTone === 'warning' ? 'Attention' : 'Operational'}
              helper={USE_MOCK_API ? 'Simulated monitoring enabled' : 'Connected to API'}
              icon="health"
            />
          </div>

          <div className="home-grid">
            <article className="surface-card nested-card">
              <SectionHeader title="How UniQueue Works" subtitle="Simple three-step flow" />
              <ol className="steps-list">
                <li>
                  <strong>Choose slot</strong>
                  <span>Select the best available time from a structured slot list.</span>
                </li>
                <li>
                  <strong>Confirm booking</strong>
                  <span>Submit your details and verify policy before final confirmation.</span>
                </li>
                <li>
                  <strong>Join digital queue</strong>
                  <span>Get queue number and service status updates in one place.</span>
                </li>
              </ol>
            </article>

            <article className="surface-card nested-card">
              <SectionHeader title="UniQueue Capabilities" subtitle="Current and near-term scope" />
              <div className="feature-grid">
                <FeatureCard
                  icon="booking"
                  title="Time-slot operations"
                  description="Balanced service demand through student-friendly slot reservations."
                />
                <FeatureCard
                  icon="queue"
                  title="Digital queue flow"
                  description="Queue numbers and status badges reduce uncertainty at service points."
                />
                <FeatureCard
                  icon="health"
                  title="Service observability"
                  description="Track frontend, API, auth, and booking service condition quickly."
                />
                <FeatureCard
                  icon="food"
                  title="Pre-order roadmap"
                  description="Future module for cafeteria pre-order and pickup optimization."
                />
                <FeatureCard
                  icon="analytics"
                  title="Admin analytics roadmap"
                  description="Peak-hour insights and capacity tuning for operational staff."
                />
              </div>
            </article>
          </div>
        </section>
      )}

      {currentUser && view === 'timeslots' && (
        <section className="surface-card">
          <SectionHeader
            title="Time Slots"
            subtitle="Browse availability, choose a slot, and move straight to booking."
            right={<button type="button" onClick={() => void loadSlots()} className="btn btn-secondary">Refresh Slots</button>}
          />

          <div className="stats-grid compact">
            <StatCard title="Total slots" value={String(slots.length)} icon="slots" />
            <StatCard title="Selected slot" value={selectedSlot || 'Not selected'} icon="check" />
            <StatCard title="Occupied" value={String(occupiedSlots.size)} icon="queue" />
            <StatCard title="Booking tip" value="Morning slots fill faster" helper="Reserve early when possible" icon="alert" />
          </div>

          <div className="slot-controls">
            {[
              { label: 'All', value: 'all' },
              { label: 'Morning', value: 'morning' },
              { label: 'Afternoon', value: 'afternoon' },
              { label: 'Evening', value: 'evening' },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`btn ${slotFilter === filter.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSlotFilter(filter.value as SlotFilter)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="slot-groups">
            {(['morning', 'afternoon', 'evening'] as const).map((period) => (
              <article key={period} className="surface-card nested-card slot-group-card">
                <SectionHeader
                  title={period.charAt(0).toUpperCase() + period.slice(1)}
                  subtitle={`${groupedSlots[period].length} slots`}
                />
                <div className="slot-grid">
                  {groupedSlots[period].map((slot) => (
                    <div key={slot} className="slot-chip-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (occupiedSlots.has(slot)) {
                            return
                          }
                          setEditingBookingId(null)
                          setSelectedSlot(slot)
                          setView('booking')
                        }}
                        disabled={occupiedSlots.has(slot)}
                        className={`slot-chip ${selectedSlot === slot ? 'slot-chip-active' : ''} ${occupiedSlots.has(slot) ? 'slot-chip-occupied' : ''}`}
                      >
                        {slot}
                      </button>
                      {occupiedSlots.has(slot) && <span className="slot-indicator">Booked</span>}
                    </div>
                  ))}
                  {groupedSlots[period].length === 0 && (
                    <p className="subtle-text">No slots for this period.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {currentUser && view === 'booking' && (
        <section className="surface-card">
          <SectionHeader
            title="Booking"
            subtitle="Confirm your details and reserve a slot with clear policy guidance."
          />

          <div className="booking-layout">
            <form onSubmit={handleBooking} className="surface-card nested-card form-card booking-form">
              <label className="field-block">
                <span>Full name</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, name: undefined }))
                  }}
                  placeholder="Enter your full name"
                  className={`field ${bookingFieldErrors.name ? 'field-error' : ''}`}
                />
                <small>Use your legal name for service validation.</small>
                {bookingFieldErrors.name && <small className="error-text">{bookingFieldErrors.name}</small>}
              </label>

              <label className="field-block">
                <span>Student ID</span>
                <input
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, studentId: undefined }))
                  }}
                  placeholder="e.g. 23B030123"
                  className={`field ${bookingFieldErrors.studentId ? 'field-error' : ''}`}
                />
                <small>Student ID is required to process queue and service records.</small>
                {bookingFieldErrors.studentId && <small className="error-text">{bookingFieldErrors.studentId}</small>}
              </label>

              <label className="field-block">
                <span>Time slot</span>
                <select
                  value={selectedSlot}
                  onChange={(event) => {
                    setSelectedSlot(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, slot: undefined }))
                  }}
                  className={`field ${bookingFieldErrors.slot ? 'field-error' : ''}`}
                >
                  <option value="" disabled>Choose a time slot</option>
                  {slots.map((slot) => (
                    <option key={slot} value={slot} disabled={occupiedSlotsForBookingForm.has(slot)}>
                      {slot}{occupiedSlotsForBookingForm.has(slot) ? ' (Booked)' : ''}
                    </option>
                  ))}
                </select>
                <small>Tip: choose morning slots for lower queue pressure.</small>
                {bookingFieldErrors.slot && <small className="error-text">{bookingFieldErrors.slot}</small>}
              </label>

              <button type="submit" className="btn btn-primary booking-cta">
                {editingBookingId ? 'Save Reschedule' : 'Confirm Booking'}
              </button>
            </form>

            <aside className="surface-card nested-card booking-summary">
              <SectionHeader title="Booking Preview" subtitle="Review before confirmation" />
              <ul className="summary-list">
                <li>
                  <span>Student</span>
                  <strong>{name || currentUser.fullName}</strong>
                </li>
                <li>
                  <span>Student ID</span>
                  <strong>{studentId || 'Not provided'}</strong>
                </li>
                <li>
                  <span>Selected slot</span>
                  <strong>{selectedSlot || 'No slot selected'}</strong>
                </li>
                <li>
                  <span>{editingBookingId ? 'Current mode' : 'Estimated queue number'}</span>
                  <strong>{editingBookingId ? 'Reschedule existing booking' : generateQueueNumber(bookings.length)}</strong>
                </li>
              </ul>

              <div className="policy-box">
                <h4>Booking policy</h4>
                <p>Arrive at least 5 minutes before your slot. Late arrivals may be moved to pending queue.</p>
              </div>
            </aside>
          </div>
        </section>
      )}

      {currentUser && view === 'bookings' && (
        <section className="surface-card">
          <SectionHeader
            title="Bookings"
            subtitle="Track your queue records and manage booking actions."
            right={<button type="button" onClick={() => void loadBookings()} className="btn btn-secondary">Refresh List</button>}
          />

          {!bookings.length && (
            <EmptyState
              title="No bookings yet"
              description="Create your first booking to receive a queue number and service status."
              action={<button type="button" className="btn btn-primary" onClick={() => setView('booking')}>Create Booking</button>}
            />
          )}

          {!!bookings.length && (
            <div className="booking-list">
              {bookings.map((booking) => {
                const status = booking.status || 'Confirmed'
                const tone = status === 'Completed' ? 'success' : status === 'Pending' ? 'warning' : 'info'

                return (
                  <article key={booking.id} className="booking-card">
                    <div className="booking-primary">
                      <div className="queue-badge">{booking.queueNumber}</div>
                      <div>
                        <h3>{booking.name}</h3>
                        <p>{booking.studentId} • {booking.slot}</p>
                        {booking.createdAt && <small>Booked at {booking.createdAt}</small>}
                      </div>
                    </div>

                    <div className="booking-actions">
                      <StatusPill label={status} tone={tone} />
                      <button type="button" className="btn btn-ghost" onClick={() => prepareReschedule(booking)}>
                        Reschedule
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => void handleCancel(booking.id)}>
                        Cancel
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {currentUser && view === 'health' && (
        <section className="surface-card">
          <SectionHeader
            title="System Health"
            subtitle="Operational overview across core services"
            right={<button type="button" onClick={() => void checkHealth()} className="btn btn-secondary">Refresh Status</button>}
          />

          <div className="health-overview">
            <StatCard
              title="Current status"
              value={healthTone === 'warning' ? 'Attention Needed' : 'Operational'}
              helper={health}
              icon="health"
            />
            <StatCard
              title="Last checked"
              value={lastCheckedAt}
              helper={healthLatencyMs !== null ? `Latency: ${healthLatencyMs} ms` : 'No latency data'}
              icon="analytics"
            />
          </div>

          <div className="health-grid">
            <article className="health-row">
              <div>
                <h3>Frontend</h3>
                <p>React interface and client rendering</p>
              </div>
              <StatusPill label="Operational" tone="success" />
            </article>

            <article className="health-row">
              <div>
                <h3>Backend API</h3>
                <p>{USE_MOCK_API ? 'Simulated in mock mode' : 'Connected to live API'}</p>
              </div>
              <StatusPill label={USE_MOCK_API ? 'Simulated' : 'Online'} tone={USE_MOCK_API ? 'info' : 'success'} />
            </article>

            <article className="health-row">
              <div>
                <h3>Authentication</h3>
                <p>Access control for SDU user accounts</p>
              </div>
              <StatusPill label={USE_MOCK_API ? 'Mock Auth' : 'Active'} tone={USE_MOCK_API ? 'info' : 'success'} />
            </article>

            <article className="health-row">
              <div>
                <h3>Booking service</h3>
                <p>Slot processing and queue number generation</p>
              </div>
              <StatusPill label={bookings.length ? 'Active' : 'Idle'} tone={bookings.length ? 'success' : 'neutral'} />
            </article>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
