import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'
import {
  API_ENDPOINTS,
  apiRequest,
  fetchJson,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  buildApiUrl,
} from './config/api'

type BookingStatus = 'Confirmed' | 'Waiting' | 'Completed' | 'Cancelled'

type Booking = {
  id: string
  name: string
  studentId: string
  service: string
  purpose: string
  date: string
  slot: string
  createdAt?: string
  queueNumber?: string
  status?: BookingStatus
}

type Service = {
  id: string
  name: string
  description: string
  icon: string
  hours: string
  queueLoad: number // 0-100
}

type Role = 'student' | 'staff' | 'admin'

type View =
  | 'home'
  | 'timeslots'
  | 'booking'
  | 'bookings'
  | 'health'
  | 'login'
  | 'register'
  | 'analytics'
  | 'staff-dashboard'
  | 'queue'
  | 'services'
  | 'users'

type SlotFilter = 'all' | 'morning' | 'afternoon' | 'evening'

type MockUser = {
  fullName: string
  email: string
  password: string
}

type AuthUser = {
  fullName: string
  email: string
  role: Role
  studentId?: string
}

const API = API_ENDPOINTS

const getNavigationTabs = (role: Role) => {
  if (role === 'student') {
    return [
      { label: 'Home', value: 'home' },
      { label: 'Time Slots', value: 'timeslots' },
      { label: 'Booking', value: 'booking' },
      { label: 'My Bookings', value: 'bookings' },
      { label: 'Health Check', value: 'health' },
    ]
  }

  if (role === 'staff') {
    return [
      { label: 'Staff Dashboard', value: 'staff-dashboard' },
      { label: 'Queue', value: 'queue' },
      { label: 'Bookings', value: 'bookings' },
      { label: 'Health Check', value: 'health' },
    ]
  }

  return [
    { label: 'Admin Dashboard', value: 'home' },
    { label: 'Analytics', value: 'analytics' },
    { label: 'Services', value: 'services' },
    { label: 'Users', value: 'users' },
    { label: 'Health Check', value: 'health' },
  ]
}

const getDefaultViewForRole = (role: Role): View => {
  if (role === 'student') return 'home'
  if (role === 'staff') return 'staff-dashboard'
  return 'home'
}

const isAuthorizedView = (view: View, role: Role) => {
  const allowed: Record<Role, View[]> = {
    student: ['home', 'timeslots', 'booking', 'bookings', 'health'],
    staff: ['staff-dashboard', 'queue', 'bookings', 'health'],
    admin: ['home', 'analytics', 'services', 'users', 'health'],
  }
  return allowed[role].includes(view)
}

const FORCE_MOCK_MODE = (import.meta.env.VITE_FORCE_MOCK_MODE as string | undefined) === 'true'
const USE_MOCK_AUTH = (import.meta.env.VITE_USE_MOCK_AUTH as string | undefined) === 'true'
const MOCK_DELAY_MS = 250
const MOCK_USERS_KEY = 'uqs-mock-users'
const MOCK_BOOKINGS_KEY = 'uqs-mock-bookings'
const MOCK_CURRENT_USER_KEY = 'uqs-current-user'

const MOCK_SERVICES: Service[] = [
  {
    id: 'deans-office',
    name: "Dean's Office",
    description: 'Academic advising, course registration, and degree planning',
    icon: '🎓',
    hours: '9:00 AM - 5:00 PM',
    queueLoad: 45,
  },
  {
    id: 'library',
    name: 'Library',
    description: 'Book borrowing, study room reservations, and research assistance',
    icon: '📚',
    hours: '8:00 AM - 8:00 PM',
    queueLoad: 25,
  },
  {
    id: 'student-services',
    name: 'Student Service Center',
    description: 'ID cards, transcripts, financial aid, and general inquiries',
    icon: '👥',
    hours: '9:00 AM - 6:00 PM',
    queueLoad: 60,
  },
  {
    id: 'registrar',
    name: 'Registrar Office',
    description: 'Grade reports, enrollment verification, and official documents',
    icon: '📋',
    hours: '8:30 AM - 4:30 PM',
    queueLoad: 35,
  },
  {
    id: 'cafeteria',
    name: 'Cafeteria',
    description: 'Meal plans, dietary accommodations, and food service issues',
    icon: '🍽️',
    hours: '7:00 AM - 7:00 PM',
    queueLoad: 15,
  },
]

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

const formatSlotLabelFromIso = (isoDateTime: string) => {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) {
    return isoDateTime
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const validateSduEmail = (email: string) => /^[a-z0-9._%+-]+@sdu\.edu\.kz$/i.test(email.trim())
const validateStudentId = (id: string) => /^[a-zA-Z0-9-]{5,20}$/.test(id.trim())

const getSlotPeriod = (slot: string): Exclude<SlotFilter, 'all'> => {
  const hourMatch = slot.match(/(\d{1,2}):(\d{2})/)
  const hour = hourMatch ? Number(hourMatch[1]) : 0
  if (hour < 12) {
    return 'morning'
  }
  if (hour < 16) {
    return 'afternoon'
  }
  return 'evening'
}

const toStatus = (value?: string): BookingStatus => {
  if (value === 'Waiting' || value === 'Completed' || value === 'Cancelled') {
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

const loadCurrentUser = (): AuthUser | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(MOCK_CURRENT_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const role = (parsed.role || parsed.user_role || 'student') as Role

    return {
      fullName: parsed.fullName || parsed.user_name || parsed.name || 'SDU User',
      email: parsed.email || '',
      role,
      studentId: parsed.studentId || parsed.student_id || undefined,
    }
  } catch {
    return null
  }
}

const saveCurrentUser = (user: AuthUser | null) => {
  if (typeof window !== 'undefined') {
    if (user) {
      window.localStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(MOCK_CURRENT_USER_KEY)
    }
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

const buildMockBooking = (name: string, studentId: string, service: string, purpose: string, date: string, slot: string, count: number): Booking => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    name,
    studentId,
    service,
    purpose,
    date,
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
  const [slotIdByLabel, setSlotIdByLabel] = useState<Record<string, string>>({})
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
  const [, setBackendConnected] = useState(false)

  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [mockUsers, setMockUsers] = useState<MockUser[]>(() => loadMockUsers())
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadCurrentUser())

  const [bookingFieldErrors, setBookingFieldErrors] = useState<{ name?: string, studentId?: string, service?: string, purpose?: string, date?: string, slot?: string }>({})

  const [selectedService, setSelectedService] = useState('')
  const [purpose, setPurpose] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])

  const authViews: View[] = ['login', 'register']
  const useMockApi = FORCE_MOCK_MODE

  useEffect(() => {
    if (FORCE_MOCK_MODE) {
      setBackendConnected(false)
      return
    }

    const probeBackend = async () => {
      try {
        const data = await fetchJson(API.health)
        setBackendConnected(true)
        setHealth(typeof data === 'string' ? data : data.status || 'OK')
      } catch {
        setBackendConnected(false)
      }
    }

    void probeBackend()
  }, [])

  useEffect(() => {
    if (useMockApi) {
      saveMockBookings(bookings)
    }
  }, [bookings, useMockApi])

  useEffect(() => {
    saveCurrentUser(currentUser)
  }, [currentUser])

  useEffect(() => {
    setMessage(null)

    if (!currentUser) {
      const token = getStoredToken()
      const persistedUser = loadCurrentUser()
      if (token && persistedUser) {
        setCurrentUser(persistedUser)
      }
    }

    if (!currentUser && !authViews.includes(view)) {
      setView('login')
      return
    }

    if (currentUser && (view === 'timeslots' || view === 'booking')) {
      void loadSlots()
    }
    if (currentUser && view === 'bookings') {
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
    if (!currentUser) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Try real API first
      const data = await apiRequest(API.timeslots)
      const remoteSlotsRaw = Array.isArray(data) ? data : []

      const normalizedSlots = remoteSlotsRaw.map((slot: { slot_id: string, start_time: string }) => ({
        id: slot.slot_id,
        label: formatSlotLabelFromIso(slot.start_time),
      }))

      const unique = Array.from(new Map(normalizedSlots.map((slot) => [slot.label, slot])).values())
      const finalLabels = unique.length ? unique.map((slot) => slot.label) : generateTimeSlots()
      const slotIdMap = Object.fromEntries(unique.map((slot) => [slot.label, slot.id]))

      setSlots(finalLabels)
      setSlotIdByLabel(slotIdMap)
      setBackendConnected(true)
      setSelectedSlot((current) => current || findFirstFreeSlot(finalLabels, bookings))
    } catch (error) {
      console.warn('Failed to load slots from backend:', error)
      setBackendConnected(false)

      // Fallback to mock slots
      if (!FORCE_MOCK_MODE) {
        setMessage('Could not fetch time slots from server. Using default schedule.')
      }
      const fallbackSlots = generateTimeSlots()
      setSlots(fallbackSlots)
      setSlotIdByLabel({})
      setSelectedSlot((current) => current || findFirstFreeSlot(fallbackSlots, bookings))
    } finally {
      setLoading(false)
    }
  }

  const loadBookings = async () => {
    if (!currentUser) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Try real API first
      const data = await apiRequest(API.bookings)
      const incoming = (Array.isArray(data) ? data : []) as Array<{
        id: string
        student_name?: string
        student_email?: string
        timeslot_start?: string
        created_at?: string
        service?: string
        purpose?: string
        date?: string
        status?: string
        queue_number?: string
      }>

      const normalized = incoming.map((booking, index) => normalizeBooking({
        id: booking.id,
        name: booking.student_name || 'Unknown',
        studentId: booking.student_email?.split('@')[0] || 'unknown',
        service: booking.service || 'General',
        purpose: booking.purpose || 'Appointment',
        date: booking.date || new Date().toISOString().split('T')[0],
        slot: booking.timeslot_start ? formatSlotLabelFromIso(booking.timeslot_start) : 'TBD',
        createdAt: booking.created_at ? new Date(booking.created_at).toLocaleString('en-US') : new Date().toLocaleString('en-US'),
        queueNumber: booking.queue_number,
        status: toStatus(booking.status),
      }, index))

      setBookings(normalized)
      setBackendConnected(true)
    } catch (error) {
      console.warn('Failed to load bookings from backend:', error)
      setBackendConnected(false)

      // Fallback to mock data if backend fails
      if (!FORCE_MOCK_MODE) {
        setMessage('Could not fetch bookings from server. Showing cached data.')
        // Keep existing mock bookings or show empty
        setBookings(loadMockBookings())
      } else {
        setMessage('Could not fetch bookings. Please check your connection.')
        setBookings([])
      }
    } finally {
      setLoading(false)
    }
  }

  const checkHealth = async () => {
    const startedAt = performance.now()
    setLoading(true)
    setMessage(null)

    try {
      if (FORCE_MOCK_MODE) {
        await wait(MOCK_DELAY_MS)
        setHealth('Mock mode active. Backend is not connected yet.')
        setBackendConnected(false)
        setHealthLatencyMs(Math.round(performance.now() - startedAt))
        setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
        return
      }

      const data = await apiRequest(API.health)
      setHealth(typeof data === 'string' ? data : data.status || 'OK')
      setBackendConnected(true)
      setHealthLatencyMs(Math.round(performance.now() - startedAt))
      setLastCheckedAt(new Date().toLocaleTimeString('en-US'))
    } catch (error) {
      console.warn('Health check failed:', error)
      setBackendConnected(false)
      setMessage('Backend is unavailable. Please try again later.')
      setHealth('Server is unavailable. Limited functionality available.')
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
      setMessage('Full name is required.')
      return
    }

    if (!normalizedEmail) {
      setMessage('Email is required.')
      return
    }

    if (!validateSduEmail(normalizedEmail)) {
      setMessage('Email must end with @sdu.edu.kz.')
      return
    }

    const emailUsername = normalizedEmail.split('@')[0]
    const isStudentEmail = /^[0-9]+$/.test(emailUsername)
    if (!isStudentEmail) {
      setMessage('Public registration is only for students. Staff and admin accounts are created by the administrator.')
      return
    }

    if (normalizedPassword.length < 6) {
      setMessage('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      if (USE_MOCK_AUTH) {
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
        setRegisterName('')
        setRegisterEmail('')
        setRegisterPassword('')
        setMessage('Registration successful. Please login with your credentials.')
        setView('login')
        return
      }

      const studentIdFromEmail = normalizedEmail.split('@')[0]
      const registerUrl = buildApiUrl(API.register)
      
      console.log('Register request URL:', registerUrl)
      console.log('Register request body:', {
        full_name: registerName.trim(),
        email: normalizedEmail,
        student_id: studentIdFromEmail,
        password: normalizedPassword,
        role: 'student',
      })
      
      const response = await apiRequest(API.register, {
        method: 'POST',
        body: JSON.stringify({
          full_name: registerName.trim(),
          email: normalizedEmail,
          student_id: studentIdFromEmail,
          password: normalizedPassword,
          role: 'student',
        }),
      })
      
      console.log('Register response:', response)

      setRegisterName('')
      setRegisterEmail('')
      setRegisterPassword('')
      setMessage('Registration successful. Please login with your credentials.')
      setView('login')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not register user.')
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
      if (USE_MOCK_AUTH) {
        await wait(MOCK_DELAY_MS)
        const existingUser = mockUsers.find(
          (user) => user.email === normalizedEmail && user.password === normalizedPassword,
        )

        if (!existingUser) {
          setMessage('Invalid credentials. Try again or register first.')
          return
        }

        setCurrentUser({ fullName: existingUser.fullName, email: existingUser.email, role: 'student' })
        setLoginEmail('')
        setLoginPassword('')
        setMessage('Logged in successfully.')
        setView('home')
        return
      }

      const loginUrl = buildApiUrl(API.login)
      
      console.log('Login request URL:', loginUrl)
      console.log('Login request body:', {
        email: normalizedEmail,
        password: normalizedPassword,
      })
      
      const response = await apiRequest(API.login, {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      })
      
      console.log('Login response status:', response.status)
      console.log('Login response:', response)

      const token = response.access_token || response.token || null
      if (token) {
        setStoredToken(token)
      }

      const fullName = response.user_name || response.user?.user_name || response.user?.name || response.name || 'SDU User'
      const role = (response.user_role || response.user?.user_role || response.user?.role || response.role || 'student') as Role

      setCurrentUser({
        fullName,
        email: normalizedEmail,
        role,
      })
      setLoginEmail('')
      setLoginPassword('')
      setMessage('Logged in successfully.')
      setView(getDefaultViewForRole(role))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not login user.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearStoredToken()
    setCurrentUser(null)
    setMessage('You have been logged out.')
    setView('login')
  }

  const handleBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: { name?: string, studentId?: string, service?: string, purpose?: string, date?: string, slot?: string } = {}

    if (!name.trim()) {
      nextErrors.name = 'Full name is required.'
    }
    if (!validateStudentId(studentId)) {
      nextErrors.studentId = 'Use a valid student ID (5-20 characters).'
    }
    if (!selectedService) {
      nextErrors.service = 'Choose a service first.'
    }
    if (!purpose.trim()) {
      nextErrors.purpose = 'Purpose is required.'
    }
    if (!selectedDate) {
      nextErrors.date = 'Choose a date.'
    }
    if (!selectedSlot) {
      nextErrors.slot = 'Choose a slot first.'
    }

    const occupiedByOtherBooking = bookings.some(
      (booking) => booking.slot === selectedSlot && booking.date === selectedDate && booking.id !== editingBookingId,
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
      if (useMockApi) {
        await wait(MOCK_DELAY_MS)
        if (editingBookingId) {
          setBookings((current) => current.map((booking) => (
            booking.id === editingBookingId
              ? {
                  ...booking,
                  name: name.trim(),
                  studentId: studentId.trim(),
                  service: selectedService,
                  purpose: purpose.trim(),
                  date: selectedDate,
                  slot: selectedSlot,
                  status: 'Confirmed',
                }
              : booking
          )))
          setEditingBookingId(null)
          setName(currentUser.fullName)
          setStudentId('')
          setSelectedService('')
          setPurpose('')
          setSelectedDate(new Date().toISOString().split('T')[0])
          setMessage('Booking rescheduled successfully in mock mode.')
          setView('bookings')
          return
        }

        const newBooking = buildMockBooking(name.trim(), studentId.trim(), selectedService, purpose.trim(), selectedDate, selectedSlot, bookings.length)
        setBookings((current) => [...current, newBooking])
        setEditingBookingId(null)
        setName(currentUser.fullName)
        setStudentId('')
        setSelectedService('')
        setPurpose('')
        setSelectedDate(new Date().toISOString().split('T')[0])
        setMessage(`Booking confirmed in mock mode. Queue number: ${newBooking.queueNumber}`)
        setView('bookings')
        return
      }

      const slotId = slotIdByLabel[selectedSlot]
      if (!slotId) {
        setMessage('Selected slot is not recognized by backend. Please refresh slots.')
        setBackendConnected(false)
        return
      }

      if (editingBookingId) {
        const rescheduled = await fetchJson(API.bookings, {
          method: 'POST',
          body: JSON.stringify({
            student_name: name.trim(),
            student_email: `${studentId.trim().toLowerCase()}@sdu.edu.kz`,
            service_type: selectedService,
            purpose: purpose.trim(),
            date: selectedDate,
            slot_id: slotId,
          }),
        }) as {
          id: string
          student_name: string
          student_email: string
          timeslot_start: string
          created_at: string
        }

        await fetchJson(`${API.bookings}/${editingBookingId}`, { method: 'DELETE' })

        const normalized = normalizeBooking({
          id: rescheduled.id,
          name: rescheduled.student_name,
          studentId: rescheduled.student_email.split('@')[0] || studentId.trim(),
          service: selectedService,
          purpose: purpose.trim(),
          date: selectedDate,
          slot: formatSlotLabelFromIso(rescheduled.timeslot_start),
          createdAt: new Date(rescheduled.created_at).toLocaleString('en-US'),
          status: 'Confirmed',
        }, bookings.length)

        setBookings((current) => {
          const withoutOld = current.filter((booking) => booking.id !== editingBookingId)
          return [...withoutOld, normalized]
        })
        setBackendConnected(true)
        setEditingBookingId(null)
        setStudentId('')
        setSelectedService('')
        setPurpose('')
        setSelectedDate(new Date().toISOString().split('T')[0])
        setMessage(`Booking rescheduled successfully. New queue: ${normalized.queueNumber}`)
        setView('bookings')
        return
      }

      const created = await apiRequest(API.bookings, {
        method: 'POST',
        body: JSON.stringify({
          student_name: name.trim(),
          student_email: `${studentId.trim().toLowerCase()}@sdu.edu.kz`,
          service: selectedService,
          purpose: purpose.trim(),
          date: selectedDate,
          slot_id: slotId,
        }),
      }) as {
        id: string
        student_name?: string
        student_email?: string
        timeslot_start?: string
        created_at?: string
        service?: string
        purpose?: string
        date?: string
        queue_number?: string
        status?: string
      }

      const normalized = normalizeBooking({
        id: created.id,
        name: created.student_name || name.trim(),
        studentId: created.student_email?.split('@')[0] || studentId.trim(),
        service: created.service || selectedService,
        purpose: created.purpose || purpose.trim(),
        date: created.date || selectedDate,
        slot: created.timeslot_start ? formatSlotLabelFromIso(created.timeslot_start) : selectedSlot,
        createdAt: created.created_at ? new Date(created.created_at).toLocaleString('en-US') : new Date().toLocaleString('en-US'),
        queueNumber: created.queue_number,
        status: toStatus(created.status),
      }, bookings.length)
      setBookings((current) => [...current, normalized])
      setBackendConnected(true)
      setEditingBookingId(null)
      setStudentId('')
      setSelectedService('')
      setPurpose('')
      setSelectedDate(new Date().toISOString().split('T')[0])
      setMessage(`Booking created successfully. Queue number: ${normalized.queueNumber}`)
      setView('bookings')
    } catch {
      setBackendConnected(false)
      setMessage('Could not create booking.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    setLoading(true)
    setMessage(null)

    try {
      // Try real API first
      await apiRequest(`${API.bookings}/${id}`, { method: 'DELETE' })
      setBookings((current) => current.filter((booking) => booking.id !== id))
      setBackendConnected(true)
      if (editingBookingId === id) {
        setEditingBookingId(null)
        setSelectedSlot('')
      }
      setMessage('Booking canceled successfully.')
    } catch (error) {
      console.warn('Failed to cancel booking on backend:', error)
      setBackendConnected(false)

      // Fallback to local cancellation if backend fails
      if (!FORCE_MOCK_MODE) {
        setBookings((current) => current.filter((booking) => booking.id !== id))
        setMessage('Booking canceled locally (server unavailable).')
      } else {
        setMessage('Could not cancel booking. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const prepareReschedule = (booking: Booking) => {
    setEditingBookingId(booking.id)
    setName(booking.name)
    setStudentId(booking.studentId)
    setSelectedService(booking.service)
    setPurpose(booking.purpose)
    setSelectedDate(booking.date)
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
            <StatusPill label={useMockApi ? 'Local API Mode' : 'Live API Mode'} tone={useMockApi ? 'info' : 'success'} />
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
              <StatusPill label={currentUser.role?.charAt(0).toUpperCase() + currentUser.role.slice(1)} tone="info" />
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
          ? getNavigationTabs(currentUser.role)
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

      {currentUser && !isAuthorizedView(view, currentUser.role) && (
        <section className="surface-card">
          <SectionHeader
            title="Access denied"
            subtitle="You do not have permission to view this page."
          />
          <p>Please contact the administrator if you believe this is an error.</p>
        </section>
      )}

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
                    placeholder="230103152@sdu.edu.kz"
                    className="field"
                  />
                  <small>Use your student SDU email. Your Student ID will be detected automatically.</small>
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
              <SectionHeader title="Campus Queue Management" subtitle="A production-ready system for managing university service queues." />
              <ul>
                <li>Secure SDU student authentication</li>
                <li>Real-time booking and queue tracking</li>
                <li>Role-based access for students, staff, and administrators</li>
                <li>Cloud backend with PostgreSQL database</li>
                <li>Staff dashboard for service processing</li>
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
              helper={FORCE_MOCK_MODE ? 'Local API mode' : 'Connected to API'}
              icon="health"
            />
          </div>

          {currentUser.role === 'student' && (
            <>
              <div className="services-section">
                <SectionHeader title="Available Services" subtitle="Choose a service to start booking" />
                <div className="services-grid">
                  {MOCK_SERVICES.map((service) => (
                    <article key={service.id} className="service-card surface-card nested-card">
                      <div className="service-header">
                        <span className="service-icon">{service.icon}</span>
                        <div>
                          <h3>{service.name}</h3>
                          <p>{service.description}</p>
                        </div>
                      </div>
                      <div className="service-details">
                        <small>Hours: {service.hours}</small>
                        <div className="queue-load">
                          <span>Queue Load: {service.queueLoad}%</span>
                          <div className="load-bar">
                            <div className="load-fill" style={{ width: `${service.queueLoad}%` }}></div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedService(service.id)
                          setView('booking')
                        }}
                      >
                        Book Now
                      </button>
                    </article>
                  ))}
                </div>
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
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <div className="queue-display">
                <SectionHeader title="Admin Overview" subtitle="High-level university queuing metrics" />
                <div className="queue-stats">
                  <StatCard title="Total bookings today" value="47" helper="Live backend data" icon="booking" />
                  <StatCard title="Completed bookings" value="32" helper="Operational progress" icon="check" />
                  <StatCard title="Waiting students" value="12" helper="Queue status summary" icon="queue" />
                  <StatCard title="Peak hour" value="11:00 AM" helper="Highest demand" icon="analytics" />
                </div>
              </div>

              <div className="home-grid">
                <article className="surface-card nested-card">
                  <SectionHeader title="Admin tools" subtitle="Manage services and monitor system status" />
                  <ul className="steps-list">
                    <li>
                      <strong>Maintain service load</strong>
                      <span>Use analytics and queue data to balance campus services.</span>
                    </li>
                    <li>
                      <strong>Monitor user activity</strong>
                      <span>Track bookings, staff workload, and system health.</span>
                    </li>
                    <li>
                      <strong>Validate access rules</strong>
                      <span>Role-based pages ensure secure admin controls.</span>
                    </li>
                  </ul>
                </article>

                <article className="surface-card nested-card">
                  <SectionHeader title="Deployment ready" subtitle="Production-focused authentication and backend integration" />
                  <div className="feature-grid">
                    <FeatureCard
                      icon="analytics"
                      title="Service analytics"
                      description="Track peak hours and most used services across campus."
                    />
                    <FeatureCard
                      icon="health"
                      title="System reliability"
                      description="Employ real backend health checks and error handling."
                    />
                  </div>
                </article>
              </div>
            </>
          )}
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
                <span>Service</span>
                <select
                  value={selectedService}
                  onChange={(event) => {
                    setSelectedService(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, service: undefined }))
                  }}
                  className={`field ${bookingFieldErrors.service ? 'field-error' : ''}`}
                >
                  <option value="" disabled>Choose a service</option>
                  {MOCK_SERVICES.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
                <small>Select the university service you need assistance with.</small>
                {bookingFieldErrors.service && <small className="error-text">{bookingFieldErrors.service}</small>}
              </label>

              <label className="field-block">
                <span>Purpose</span>
                <input
                  value={purpose}
                  onChange={(event) => {
                    setPurpose(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, purpose: undefined }))
                  }}
                  placeholder="Brief description of your request"
                  className={`field ${bookingFieldErrors.purpose ? 'field-error' : ''}`}
                />
                <small>Describe why you're visiting this service.</small>
                {bookingFieldErrors.purpose && <small className="error-text">{bookingFieldErrors.purpose}</small>}
              </label>

              <label className="field-block">
                <span>Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value)
                    setBookingFieldErrors((current) => ({ ...current, date: undefined }))
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className={`field ${bookingFieldErrors.date ? 'field-error' : ''}`}
                />
                <small>Choose the date for your appointment.</small>
                {bookingFieldErrors.date && <small className="error-text">{bookingFieldErrors.date}</small>}
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
                  <span>Service</span>
                  <strong>{MOCK_SERVICES.find(s => s.id === selectedService)?.name || 'Not selected'}</strong>
                </li>
                <li>
                  <span>Purpose</span>
                  <strong>{purpose || 'Not provided'}</strong>
                </li>
                <li>
                  <span>Date</span>
                  <strong>{selectedDate ? new Date(selectedDate).toLocaleDateString() : 'Not selected'}</strong>
                </li>
                <li>
                  <span>Time slot</span>
                  <strong>{selectedSlot || 'No slot selected'}</strong>
                </li>
                <li>
                  <span>Estimated queue number</span>
                  <strong>{editingBookingId ? 'Reschedule existing booking' : generateQueueNumber(bookings.length)}</strong>
                </li>
                <li>
                  <span>Status</span>
                  <strong>Confirmed</strong>
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
                const tone = status === 'Completed' ? 'success' : status === 'Waiting' ? 'warning' : 'info'

                return (
                  <article key={booking.id} className="booking-card">
                    <div className="booking-primary">
                      <div className="queue-badge">{booking.queueNumber}</div>
                      <div>
                        <h3>{booking.name}</h3>
                        <p>{booking.studentId} • {MOCK_SERVICES.find(s => s.id === booking.service)?.name || booking.service}</p>
                        <p>{new Date(booking.date).toLocaleDateString()} at {booking.slot}</p>
                        <small>Purpose: {booking.purpose}</small>
                        {booking.createdAt && <small>Booked at {booking.createdAt}</small>}
                      </div>
                    </div>

                    <div className="booking-actions">
                      <StatusPill label={status} tone={tone} />
                      <button type="button" className="btn btn-ghost" onClick={() => prepareReschedule(booking)}>
                        View Details
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
                <p>{useMockApi ? 'Simulated in mock mode' : 'Connected to live API'}</p>
              </div>
              <StatusPill label={useMockApi ? 'Mock Mode' : 'Connected'} tone={useMockApi ? 'info' : 'success'} />
            </article>

            <article className="health-row">
              <div>
                <h3>Authentication</h3>
                <p>Access control for SDU user accounts</p>
              </div>
              <StatusPill label={useMockApi ? 'Mock Auth' : 'Active'} tone={useMockApi ? 'info' : 'success'} />
            </article>

            <article className="health-row">
              <div>
                <h3>Booking Service</h3>
                <p>Slot processing and queue number generation</p>
              </div>
              <StatusPill label={bookings.length ? 'Active' : 'Idle'} tone={bookings.length ? 'success' : 'neutral'} />
            </article>

            <article className="health-row">
              <div>
                <h3>Queue Service</h3>
                <p>Real-time queue management and status updates</p>
              </div>
              <StatusPill label="Active" tone="success" />
            </article>
          </div>

          {useMockApi && (
            <div className="mock-explanation">
              <SectionHeader title="Mock Mode Active" subtitle="This demo uses simulated data for offline presentation" />
              <p>
                UniQueue is currently running in mock mode, which simulates all backend services locally in your browser.
                This allows for a complete demonstration without requiring a live server connection. All bookings, authentication,
                and queue operations are stored in your browser's local storage and will persist between sessions.
              </p>
            </div>
          )}
        </section>
      )}

      {currentUser && currentUser.role === 'admin' && view === 'analytics' && (
        <section className="surface-card">
          <SectionHeader
            title="Admin Analytics"
            subtitle="Daily performance metrics and service insights"
          />

          <div className="stats-grid">
            <StatCard title="Total bookings today" value="47" helper="All services combined" icon="booking" />
            <StatCard title="Completed bookings" value="32" helper="75% completion rate" icon="check" />
            <StatCard title="Cancelled bookings" value="5" helper="10% cancellation rate" icon="alert" />
            <StatCard title="Average waiting time" value="18 min" helper="From booking to service" icon="slots" />
            <StatCard title="Peak hour" value="11:00 AM" helper="Highest booking volume" icon="analytics" />
            <StatCard title="Most used service" value="Student Service Center" helper="28 bookings today" icon="user" />
          </div>

          <div className="analytics-charts">
            <article className="surface-card nested-card">
              <SectionHeader title="Service Usage" subtitle="Bookings by service type" />
              <div className="chart-placeholder">
                <p>📊 Service usage chart would go here</p>
                <small>Mock data: Student Service Center (28), Dean's Office (12), Library (7)</small>
              </div>
            </article>

            <article className="surface-card nested-card">
              <SectionHeader title="Hourly Distribution" subtitle="Booking patterns throughout the day" />
              <div className="chart-placeholder">
                <p>📈 Hourly distribution chart would go here</p>
                <small>Mock data: Peak at 11 AM, steady from 9 AM - 4 PM</small>
              </div>
            </article>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
