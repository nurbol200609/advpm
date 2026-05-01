import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type BookingStatus = 'Confirmed' | 'Pending' | 'Completed'

type Booking = {
  id: string
  name: string
  studentId: string
  slot: string
  slotId?: string
  createdAt?: string
  queueNumber?: string
  status?: BookingStatus
}

type TimeSlot = {
  id: string
  service_type: string
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
}

type View = 'home' | 'timeslots' | 'booking' | 'bookings' | 'queue-dashboard' | 'manage-slots' | 'all-bookings' | 'health' | 'login' | 'register'
type SlotFilter = 'all' | 'morning' | 'afternoon' | 'evening'

type MockUser = {
  fullName: string
  email: string
  password: string
  role: 'student' | 'staff' | 'admin'
}

type AuthUser = {
  fullName: string
  email: string
  role: 'student' | 'staff' | 'admin'
}

// ========== НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К БЭКЕНДУ ==========
const USE_MOCK_API = false
const BASE_URL = "https://campusflow-backend-ra0h.onrender.com"
// ====================================================

const API = {
  timeslots: `${BASE_URL}/api/timeslots`,
  bookings: `${BASE_URL}/api/bookings`,
  health: `${BASE_URL}/health`,
  auth: `${BASE_URL}/api/auth`,
}

const MOCK_DELAY_MS = 250
const MOCK_USERS_KEY = 'uqs-mock-users'
const MOCK_BOOKINGS_KEY = 'uqs-mock-bookings'

const fetchJson = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${errorText}`)
  }
  return response.json()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (isoString: string) => {
  const date = new Date(isoString)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const getSlotPeriod = (timeStr: string): Exclude<SlotFilter, 'all'> => {
  const hour = parseInt(timeStr.split(':')[0])
  if (hour < 12) return 'morning'
  if (hour < 16) return 'afternoon'
  return 'evening'
}

const validateSduEmail = (email: string) => /^[a-z0-9._%+-]+@sdu\.edu\.kz$/i.test(email.trim())
const validateStudentId = (id: string) => /^[a-zA-Z0-9-]{5,20}$/.test(id.trim())

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

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  return <span className={`status-pill tone-${tone}`}>{label}</span>
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
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

function StatCard({ title, value, helper, icon }: { title: string; value: string; helper?: string; icon: string }) {
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

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
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

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
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
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [filteredSlots, setFilteredSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [health, setHealth] = useState<string>('Not checked yet')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all')
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('Not checked yet')
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)

  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mockUsers, setMockUsers] = useState<MockUser[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(MOCK_USERS_KEY)
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  })
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [bookingFieldErrors, setBookingFieldErrors] = useState<{ name?: string; studentId?: string; slot?: string }>({})

  const saveMockUsers = (users: MockUser[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
    }
  }

  const loadMockBookings = (): Booking[] => {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(MOCK_BOOKINGS_KEY)
    try { return raw ? JSON.parse(raw) : [] } catch { return [] }
  }

  const saveMockBookings = (bookingsData: Booking[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(bookingsData))
    }
  }

  useEffect(() => {
    if (USE_MOCK_API) {
      saveMockBookings(bookings)
    }
  }, [bookings])

  useEffect(() => {
    setMessage(null)
    if (!currentUser && !['login', 'register'].includes(view)) {
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
      setName(prev => prev || currentUser.fullName)
    }
  }, [currentUser])

  useEffect(() => {
    if (slotFilter === 'all') {
      setFilteredSlots(slots)
    } else {
      setFilteredSlots(slots.filter(slot => getSlotPeriod(formatTime(slot.start_time)) === slotFilter))
    }
  }, [slotFilter, slots])

  const loadSlots = async () => {
    setLoading(true)
    setMessage(null)
    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        setSlots([])
        setSelectedSlot(null)
        return
      }
      const data = await fetchJson(`${API.timeslots}/available?service_type=cafe`)
      setSlots(data)
      if (data.length > 0) {
        setSelectedSlot(data[0])
      }
    } catch (err) {
      console.error(err)
      setMessage('Could not fetch time slots.')
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
      const token = localStorage.getItem('access_token')
      const response = await fetch(API.bookings, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch bookings')
      const data = await response.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setMessage('Could not fetch bookings.')
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
        setHealth('Mock mode active')
        setHealthLatencyMs(Math.round(performance.now() - startedAt))
        setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
        return
      }
      const data = await fetchJson(API.health)
      setHealth(typeof data === 'string' ? data : data.status || 'OK')
      setHealthLatencyMs(Math.round(performance.now() - startedAt))
      setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
    } catch (err) {
      console.error(err)
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
        const exists = mockUsers.some(u => u.email === normalizedEmail)
        if (exists) {
          setMessage('Email already registered. Please login.')
          return
        }
        const newUser: MockUser = {
          fullName: registerName.trim(),
          email: normalizedEmail,
          password: normalizedPassword,
          role: 'student'
        }
        const updatedUsers = [...mockUsers, newUser]
        setMockUsers(updatedUsers)
        saveMockUsers(updatedUsers)
        setCurrentUser({ fullName: newUser.fullName, email: newUser.email, role: 'student' })
        setRegisterName('')
        setRegisterEmail('')
        setRegisterPassword('')
        setMessage('Registration successful!')
        setView('home')
        return
      }

      const response = await fetch(`${API.auth}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName.trim(),
          email: normalizedEmail,
          password: normalizedPassword,
          role: "student"
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`${response.status}: ${errorText}`)
      }

      const data = await response.json()
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)
      }
      setCurrentUser({
        fullName: data.user_name || registerName.trim(),
        email: normalizedEmail,
        role: data.user_role || 'student'
      })
      setRegisterName('')
      setRegisterEmail('')
      setRegisterPassword('')
      setMessage('Registration successful! You are now logged in.')
      setView('home')
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'Could not register user.')
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
          u => u.email === normalizedEmail && u.password === normalizedPassword
        )
        if (!existingUser) {
          setMessage('Invalid credentials or user not found.')
          return
        }
        setCurrentUser({
          fullName: existingUser.fullName,
          email: existingUser.email,
          role: existingUser.role
        })
        setLoginEmail('')
        setLoginPassword('')
        setMessage('Logged in successfully (mock mode).')
        setView('home')
        return
      }

      const response = await fetch(`${API.auth}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`${response.status}: ${errorText}`)
      }

      const data = await response.json()
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token)
      }
      setCurrentUser({
        fullName: data.user_name || 'Student',
        email: normalizedEmail,
        role: data.user_role || 'student'
      })
      setLoginEmail('')
      setLoginPassword('')
      setMessage('Logged in successfully.')
      setView('home')
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'Could not login user.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    setCurrentUser(null)
    setMessage('You have been logged out.')
    setView('login')
  }

  const handleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: { name?: string; studentId?: string; slot?: string } = {}

    if (!name.trim()) nextErrors.name = 'Full name is required.'
    if (!validateStudentId(studentId)) nextErrors.studentId = 'Use a valid student ID (5-20 characters).'
    if (!selectedSlot) nextErrors.slot = 'Choose a slot first.'

    setBookingFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setMessage('Please fix highlighted fields before confirming booking.')
      return
    }

    if (!currentUser) {
      setMessage('Please login first.')
      setView('login')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_API) {
        await wait(MOCK_DELAY_MS)
        if (editingBookingId) {
          setBookings(prev => prev.map(b => b.id === editingBookingId ? {
            ...b,
            name: name.trim(),
            studentId: studentId.trim(),
            slot: formatTime(selectedSlot!.start_time),
            slotId: selectedSlot!.id
          } : b))
          setEditingBookingId(null)
        } else {
          const newBooking: Booking = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: name.trim(),
            studentId: studentId.trim(),
            slot: formatTime(selectedSlot!.start_time),
            slotId: selectedSlot!.id,
            createdAt: new Date().toLocaleString(),
            queueNumber: `UQ-${String(bookings.length + 1).padStart(3, '0')}`,
            status: 'Confirmed'
          }
          setBookings(prev => [...prev, newBooking])
        }
        setName(currentUser.fullName)
        setStudentId('')
        setMessage(`Booking ${editingBookingId ? 'updated' : 'created'} successfully!`)
        setView('bookings')
        return
      }

      const token = localStorage.getItem('access_token')
      const response = await fetch(API.bookings, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          timeslot_id: selectedSlot!.id,
          service_type: "cafe"
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }

      const created = await response.json()
      setBookings(prev => [...prev, {
        id: created.id,
        name: name.trim(),
        studentId: studentId.trim(),
        slot: formatTime(selectedSlot!.start_time),
        slotId: selectedSlot!.id,
        createdAt: created.created_at,
        queueNumber: created.queue_number?.toString(),
        status: created.status
      }])
      setName(currentUser.fullName)
      setStudentId('')
      setMessage(`Booking created successfully. Queue number: ${created.queue_number || 'N/A'}`)
      setView(currentUser.role === 'student' ? 'bookings' : 'queue-dashboard')
      void loadSlots()
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'Could not create booking.')
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
        setBookings(prev => prev.filter(b => b.id !== id))
        if (editingBookingId === id) {
          setEditingBookingId(null)
        }
        setMessage('Booking canceled.')
        return
      }
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API.bookings}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed to cancel')
      setBookings(prev => prev.filter(b => b.id !== id))
      setMessage('Booking canceled.')
      void loadSlots()
    } catch (err) {
      console.error(err)
      setMessage('Could not cancel booking.')
    } finally {
      setLoading(false)
    }
  }

  const prepareReschedule = (booking: Booking) => {
    setEditingBookingId(booking.id)
    setName(booking.name)
    setStudentId(booking.studentId)
    const slotToSelect = slots.find(s => formatTime(s.start_time) === booking.slot)
    if (slotToSelect) setSelectedSlot(slotToSelect)
    setView('booking')
    setMessage(`Reschedule mode: update details for ${booking.queueNumber}.`)
  }

  const groupedSlots = useMemo(() => {
    const groups = { morning: [] as TimeSlot[], afternoon: [] as TimeSlot[], evening: [] as TimeSlot[] }
    filteredSlots.forEach(slot => {
      const period = getSlotPeriod(formatTime(slot.start_time))
      groups[period].push(slot)
    })
    return groups
  }, [filteredSlots])

  const occupiedSlotIds = useMemo(() => new Set(bookings.map(b => b.slotId)), [bookings])
  const occupiedSlotIdsForForm = useMemo(
    () => new Set(bookings.filter(b => b.id !== editingBookingId).map(b => b.slotId)),
    [bookings, editingBookingId]
  )
  const healthTone = health.toLowerCase().includes('unavailable') ? 'warning' : 'success'

  // Навигация в зависимости от роли
  const navItems = useMemo(() => {
    if (!currentUser) return []
    const items = [{ label: 'Home', value: 'home' }]

    if (currentUser.role === 'student') {
      items.push(
        { label: 'Time Slots', value: 'timeslots' },
        { label: 'My Bookings', value: 'bookings' }
      )
    }

    if (currentUser.role === 'staff' || currentUser.role === 'admin') {
      items.push({ label: 'Queue Dashboard', value: 'queue-dashboard' })
    }

    if (currentUser.role === 'admin') {
      items.push(
        { label: 'Manage Slots', value: 'manage-slots' },
        { label: 'All Bookings', value: 'all-bookings' }
      )
    }

    items.push({ label: 'Health Check', value: 'health' })
    return items
  }, [currentUser])

  return (
    <div className="app-shell">
      <div className="bg-accent bg-accent-one" />
      <div className="bg-accent bg-accent-two" />

      <header className="hero-card">
        <div className="hero-main">
          <div className="hero-title-wrap">
            <span className="hero-kicker">UniQueue Platform</span>
            <h1>University Queue System</h1>
            <p>Smart booking and queue operations for campus services with a clean, student-first experience.</p>
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
                <small>{currentUser.email} • {currentUser.role === 'staff' ? 'Staff' : currentUser.role === 'admin' ? 'Admin' : 'Student'}</small>
              </span>
            </div>
          ) : (
            <div className="user-pill guest-pill">
              <Icon name="alert" />
              <span>Not logged in</span>
            </div>
          )}
          {currentUser && (
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>Logout</button>
          )}
        </div>
      </header>

      <nav className="tab-nav">
        {(currentUser ? navItems : [
          { label: 'Register', value: 'register' },
          { label: 'Login', value: 'login' },
        ]).map(tab => (
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
          <SectionHeader title="Welcome to UniQueue" subtitle="Use your SDU email account to continue." />
          <div className="chip-row">
            <StatusPill label="@sdu.edu.kz only" tone="info" />
            <StatusPill label="Student ID required for booking" tone="neutral" />
            <StatusPill label="Queue number assigned instantly" tone="success" />
          </div>
          <div className="auth-grid">
            {view === 'register' && (
              <form onSubmit={handleRegister} className="surface-card form-card">
                <SectionHeader title="Register" subtitle="Create your student account" />
                <label className="field-block">
                  <span>Full name</span>
                  <input value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Enter your full name" className="field" />
                </label>
                <label className="field-block">
                  <span>SDU email</span>
                  <input type="email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} placeholder="name@sdu.edu.kz" className="field" />
                </label>
                <label className="field-block">
                  <span>Password</span>
                  <input type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Minimum 6 characters" className="field" />
                </label>
                <button type="submit" className="btn btn-primary">Create account</button>
              </form>
            )}
            {view === 'login' && (
              <form onSubmit={handleLogin} className="surface-card form-card">
                <SectionHeader title="Login" subtitle="Sign in to access bookings" />
                <label className="field-block">
                  <span>SDU email</span>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="name@sdu.edu.kz" className="field" />
                </label>
                <label className="field-block">
                  <span>Password</span>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter your password" className="field" />
                </label>
                <button type="submit" className="btn btn-primary">Sign in</button>
              </form>
            )}
          </div>
        </section>
      )}

      {currentUser && view === 'home' && (
        <section className="surface-card">
          <SectionHeader title={`Welcome back, ${currentUser.fullName.split(' ')[0]}`} subtitle="Monitor service load, booking readiness, and queue activity from one place." />
          <div className="stats-grid">
            <StatCard title="Available slots today" value={String(slots.length)} helper="09:00-18:00 schedule" icon="slots" />
            <StatCard title="Next available slot" value={slots.find(s => !occupiedSlotIds.has(s.id))?.start_time ? formatTime(slots.find(s => !occupiedSlotIds.has(s.id))!.start_time) : 'None'} helper="Tap booking to reserve" icon="booking" />
            <StatCard title="Active booking" value={bookings.length ? bookings[bookings.length-1].queueNumber || 'Ready' : 'None'} helper={bookings.length ? `${bookings[bookings.length-1].name} at ${bookings[bookings.length-1].slot}` : 'Create your first booking'} icon="queue" />
            <StatCard title="System health" value={healthTone === 'warning' ? 'Attention' : 'Operational'} helper={USE_MOCK_API ? 'Simulated monitoring enabled' : 'Connected to API'} icon="health" />
          </div>
        </section>
      )}

      {currentUser && view === 'timeslots' && currentUser.role === 'student' && (
        <section className="surface-card">
          <SectionHeader title="Time Slots" subtitle="Browse availability, choose a slot, and move straight to booking." right={<button onClick={() => void loadSlots()} className="btn btn-secondary">Refresh Slots</button>} />
          <div className="slot-controls">
            {[
              { label: 'All', value: 'all' },
              { label: 'Morning', value: 'morning' },
              { label: 'Afternoon', value: 'afternoon' },
              { label: 'Evening', value: 'evening' },
            ].map(filter => (
              <button key={filter.value} onClick={() => setSlotFilter(filter.value as SlotFilter)} className={`btn ${slotFilter === filter.value ? 'btn-primary' : 'btn-ghost'}`}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="slot-groups">
            {(['morning', 'afternoon', 'evening'] as const).map(period => groupedSlots[period].length > 0 && (
              <article key={period} className="surface-card nested-card">
                <SectionHeader title={period.charAt(0).toUpperCase() + period.slice(1)} subtitle={`${groupedSlots[period].length} slots`} />
                <div className="slot-grid">
                  {groupedSlots[period].map(slot => (
                    <div key={slot.id} className="slot-chip-wrap">
                      <button
                        onClick={() => { setSelectedSlot(slot); setView('booking') }}
                        disabled={occupiedSlotIds.has(slot.id)}
                        className={`slot-chip ${selectedSlot?.id === slot.id ? 'slot-chip-active' : ''} ${occupiedSlotIds.has(slot.id) ? 'slot-chip-occupied' : ''}`}
                      >
                        {formatDate(slot.start_time)} {formatTime(slot.start_time)}
                      </button>
                      {occupiedSlotIds.has(slot.id) && <span className="slot-indicator">Booked</span>}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {currentUser && view === 'booking' && (
        <section className="surface-card">
          <SectionHeader title="Booking" subtitle="Confirm your details and reserve a slot with clear policy guidance." />
          <div className="booking-layout">
            <form onSubmit={handleBooking} className="surface-card nested-card form-card">
              <label className="field-block">
                <span>Full name</span>
                <input value={name} onChange={e => { setName(e.target.value); setBookingFieldErrors(prev => ({ ...prev, name: undefined })) }} placeholder="Enter your full name" className={`field ${bookingFieldErrors.name ? 'field-error' : ''}`} />
                {bookingFieldErrors.name && <small className="error-text">{bookingFieldErrors.name}</small>}
              </label>
              <label className="field-block">
                <span>Student ID</span>
                <input value={studentId} onChange={e => { setStudentId(e.target.value); setBookingFieldErrors(prev => ({ ...prev, studentId: undefined })) }} placeholder="e.g. 23B030123" className={`field ${bookingFieldErrors.studentId ? 'field-error' : ''}`} />
                {bookingFieldErrors.studentId && <small className="error-text">{bookingFieldErrors.studentId}</small>}
              </label>
              <label className="field-block">
                <span>Time slot</span>
                <select
                  value={selectedSlot?.id || ''}
                  onChange={e => {
                    const slot = slots.find(s => s.id === e.target.value)
                    if (slot) setSelectedSlot(slot)
                    setBookingFieldErrors(prev => ({ ...prev, slot: undefined }))
                  }}
                  className={`field ${bookingFieldErrors.slot ? 'field-error' : ''}`}
                >
                  <option value="" disabled>Choose a time slot</option>
                  {slots.map(slot => (
                    <option key={slot.id} value={slot.id} disabled={occupiedSlotIdsForForm.has(slot.id)}>
                      {formatDate(slot.start_time)} {formatTime(slot.start_time)} {occupiedSlotIdsForForm.has(slot.id) ? ' (Booked)' : ''}
                    </option>
                  ))}
                </select>
                {bookingFieldErrors.slot && <small className="error-text">{bookingFieldErrors.slot}</small>}
              </label>
              <button type="submit" className="btn btn-primary">{editingBookingId ? 'Save Reschedule' : 'Confirm Booking'}</button>
            </form>
            <aside className="surface-card nested-card">
              <SectionHeader title="Booking Preview" subtitle="Review before confirmation" />
              <ul className="summary-list">
                <li><span>Student</span><strong>{name || currentUser.fullName}</strong></li>
                <li><span>Student ID</span><strong>{studentId || 'Not provided'}</strong></li>
                <li><span>Selected slot</span><strong>{selectedSlot ? `${formatDate(selectedSlot.start_time)} ${formatTime(selectedSlot.start_time)}` : 'No slot selected'}</strong></li>
              </ul>
              <div className="policy-box">
                <h4>Booking policy</h4>
                <p>Arrive at least 5 minutes before your slot. Late arrivals may be moved to pending queue.</p>
              </div>
            </aside>
          </div>
        </section>
      )}

      {currentUser && view === 'bookings' && currentUser.role === 'student' && (
        <section className="surface-card">
          <SectionHeader title="My Bookings" subtitle="Track your queue records and manage booking actions." right={<button onClick={() => void loadBookings()} className="btn btn-secondary">Refresh List</button>} />
          {bookings.length === 0 ? (
            <EmptyState title="No bookings yet" description="Create your first booking to receive a queue number and service status." action={<button onClick={() => setView('booking')} className="btn btn-primary">Create Booking</button>} />
          ) : (
            <div className="booking-list">
              {bookings.map(booking => (
                <article key={booking.id} className="booking-card">
                  <div className="booking-primary">
                    <div className="queue-badge">{booking.queueNumber}</div>
                    <div><h3>{booking.name}</h3><p>{booking.studentId} • {booking.slot}</p>{booking.createdAt && <small>Booked at {booking.createdAt}</small>}</div>
                  </div>
                  <div className="booking-actions">
                    <StatusPill label={booking.status || 'Confirmed'} tone={booking.status === 'Completed' ? 'success' : booking.status === 'Pending' ? 'warning' : 'info'} />
                    <button className="btn btn-ghost" onClick={() => prepareReschedule(booking)}>Reschedule</button>
                    <button className="btn btn-secondary" onClick={() => void handleCancel(booking.id)}>Cancel</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {currentUser && (view === 'queue-dashboard') && (currentUser.role === 'staff' || currentUser.role === 'admin') && (
        <section className="surface-card">
          <SectionHeader title="Queue Dashboard" subtitle="Manage active queues for all services" />
          <div className="stats-grid">
            <StatCard title="Cafeteria" value="12" helper="Waiting: 4" icon="food" />
            <StatCard title="Library" value="8" helper="Active: 2" icon="slots" />
            <StatCard title="Dean's Office" value="5" helper="Next: 10 min" icon="booking" />
          </div>
          <div className="queue-service-card">
            <h3>🍽️ Cafeteria Queue</h3>
            <div className="booking-list">
              {bookings.slice(0, 3).map(booking => (
                <article key={booking.id} className="booking-card">
                  <div className="booking-primary">
                    <div className="queue-badge">{booking.queueNumber}</div>
                    <div><h3>{booking.name}</h3><p>{booking.studentId} • {booking.slot}</p></div>
                  </div>
                  <button className="btn btn-primary">Serve</button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {currentUser && view === 'manage-slots' && currentUser.role === 'admin' && (
        <section className="surface-card">
          <SectionHeader title="Manage Time Slots" subtitle="Create, edit or remove service slots (Admin only)" />
          <div className="booking-layout">
            <form className="surface-card nested-card form-card">
              <label className="field-block">
                <span>Service Type</span>
                <select className="field">
                  <option value="cafe">🍽️ Cafeteria</option>
                  <option value="library">📚 Library</option>
                  <option value="deanery">📋 Dean's Office</option>
                </select>
              </label>
              <label className="field-block">
                <span>Date & Time</span>
                <input type="datetime-local" className="field" />
              </label>
              <label className="field-block">
                <span>Capacity</span>
                <input type="number" min="1" max="50" defaultValue="10" className="field" />
              </label>
              <button type="submit" className="btn btn-primary">Create Slot</button>
            </form>
            <aside className="surface-card nested-card">
              <SectionHeader title="Existing Slots" subtitle="Today & Tomorrow" />
              <div className="slot-grid">
                {slots.slice(0, 6).map(slot => (
                  <div key={slot.id} className="slot-chip-wrap">
                    <span className="slot-chip">{formatDate(slot.start_time)} {formatTime(slot.start_time)}</span>
                    <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>Delete</button>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      {currentUser && view === 'all-bookings' && (currentUser.role === 'staff' || currentUser.role === 'admin') && (
        <section className="surface-card">
          <SectionHeader title="All Bookings" subtitle="Complete history across all services" right={<button onClick={() => void loadBookings()} className="btn btn-secondary">Refresh</button>} />
          <div className="booking-list">
            {bookings.length === 0 ? (
              <EmptyState title="No bookings" description="No bookings found in the system." action={<button onClick={() => setView('booking')} className="btn btn-primary">Create Booking</button>} />
            ) : (
              bookings.map(booking => (
                <article key={booking.id} className="booking-card">
                  <div className="booking-primary">
                    <div className="queue-badge">{booking.queueNumber}</div>
                    <div><h3>{booking.name}</h3><p>{booking.studentId} • {booking.slot}</p></div>
                  </div>
                  <StatusPill label={booking.status || 'Confirmed'} tone={booking.status === 'Completed' ? 'success' : 'info'} />
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {currentUser && view === 'health' && (
        <section className="surface-card">
          <SectionHeader title="System Health" subtitle="Operational overview across core services" right={<button onClick={() => void checkHealth()} className="btn btn-secondary">Refresh Status</button>} />
          <div className="health-overview">
            <StatCard title="Current status" value={healthTone === 'warning' ? 'Attention Needed' : 'Operational'} helper={health} icon="health" />
            <StatCard title="Last checked" value={lastCheckedAt} helper={healthLatencyMs !== null ? `Latency: ${healthLatencyMs} ms` : 'No latency data'} icon="analytics" />
          </div>
          <div className="health-grid">
            <article className="health-row"><div><h3>Frontend</h3><p>React interface and client rendering</p></div><StatusPill label="Operational" tone="success" /></article>
            <article className="health-row"><div><h3>Backend API</h3><p>{USE_MOCK_API ? 'Simulated in mock mode' : 'Connected to live API'}</p></div><StatusPill label={USE_MOCK_API ? 'Simulated' : 'Online'} tone={USE_MOCK_API ? 'info' : 'success'} /></article>
            <article className="health-row"><div><h3>Authentication</h3><p>Access control for SDU user accounts</p></div><StatusPill label={USE_MOCK_API ? 'Mock Auth' : 'Active'} tone={USE_MOCK_API ? 'info' : 'success'} /></article>
            <article className="health-row"><div><h3>Booking service</h3><p>Slot processing and queue number generation</p></div><StatusPill label={bookings.length ? 'Active' : 'Idle'} tone={bookings.length ? 'success' : 'neutral'} /></article>
          </div>
        </section>
      )}
    </div>
  )
}

export default App