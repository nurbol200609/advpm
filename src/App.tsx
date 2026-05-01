import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'

const BASE_URL = 'https://campusflow-backend-ra0h.onrender.com'

type Role = 'student' | 'staff' | 'admin'
type ServiceType = 'cafe' | 'library' | 'deanery'
type BookingStatus = 'active' | 'cancelled' | 'completed'

type AuthUser = {
  name: string
  email: string
  role: Role
}

type ProfileInfo = {
  displayName: string
  studentId: string
  faculty: string
  group: string
  phone: string
  bio: string
  photo: string
}

type TimeSlot = {
  id: string
  service_type: ServiceType
  start_time: string
  end_time: string
  capacity: number
  booked_count: number
}

type MyBooking = {
  id: string
  queue_number: number
  status: BookingStatus
  timeslot_id: string
  created_at: string
}

type StaffBooking = {
  id: string
  queue?: number
  queue_number?: number
  status: BookingStatus
  slot?: string
  timeslot_id?: string
}

type QueueItem = {
  booking_id: string
  queue_number: number
  student_name: string
  timeslot_id: string
}

type SlotForm = {
  service_type: ServiceType
  start_time: string
  end_time: string
  capacity: string
}

type AdminUserForm = {
  name: string
  email: string
  password: string
  role: Extract<Role, 'staff' | 'admin'>
}

type View = 'slots' | 'my' | 'queue' | 'all' | 'profile' | 'manage-slots' | 'users' | 'analytics'
type AuthMode = 'login' | 'register'

const services: Array<{ id: ServiceType; title: string; short: string }> = [
  { id: 'cafe', title: 'Cafe', short: 'CF' },
  { id: 'library', title: 'Library', short: 'LB' },
  { id: 'deanery', title: 'Deanery', short: 'DN' },
]

const serviceLabel = (service: ServiceType) => services.find((item) => item.id === service)?.title ?? service

const statusLabel: Record<BookingStatus, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

const tokenKey = 'campusflow_token'
const userKey = 'campusflow_user'
const profileKey = 'campusflow_profile'

const emptyProfile: ProfileInfo = {
  displayName: '',
  studentId: '',
  faculty: 'School of Information Technologies and Applied Mathematics',
  group: '',
  phone: '',
  bio: 'Focused on campus life, classes, and getting through queues on time.',
  photo: '',
}

const emptySlotForm: SlotForm = {
  service_type: 'cafe',
  start_time: '',
  end_time: '',
  capacity: '10',
}

const emptyAdminUserForm: AdminUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'staff',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatTimeRange(slot: TimeSlot) {
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${fmt.format(new Date(slot.start_time))} - ${fmt.format(new Date(slot.end_time))}`
}

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const text = await response.text()
  let body: any = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : body?.detail || body?.msg || text || response.statusText
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(', ') : detail)
  }

  return body as T
}

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [view, setView] = useState<View>('slots')
  const [service, setService] = useState<ServiceType>('cafe')
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(userKey)
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey))
  const [profile, setProfile] = useState<ProfileInfo>(() => {
    const saved = localStorage.getItem(profileKey)
    return saved ? { ...emptyProfile, ...JSON.parse(saved) } : emptyProfile
  })

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')

  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [myBookings, setMyBookings] = useState<MyBooking[]>([])
  const [allBookings, setAllBookings] = useState<StaffBooking[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm)
  const [adminUserForm, setAdminUserForm] = useState<AdminUserForm>(emptyAdminUserForm)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null
  const isStaff = user?.role === 'staff' || user?.role === 'admin'
  const profileName = profile.displayName || user?.name || 'Student'
  const avatarLetter = profileName.slice(0, 1).toUpperCase()

  const slotById = useMemo(() => {
    return new Map(slots.map((slot) => [slot.id, slot]))
  }, [slots])

  const bookingStats = useMemo(() => {
    const total = allBookings.length
    const active = allBookings.filter((booking) => booking.status === 'active').length
    const completed = allBookings.filter((booking) => booking.status === 'completed').length
    const cancelled = allBookings.filter((booking) => booking.status === 'cancelled').length

    return { total, active, completed, cancelled }
  }, [allBookings])

  const saveSession = (nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(tokenKey, nextToken)
    localStorage.setItem(userKey, JSON.stringify(nextUser))
    localStorage.setItem('access_token', nextToken)
    localStorage.setItem('user_role', nextUser.role)
    setToken(nextToken)
    setUser(nextUser)
    setProfile((current) => {
      const nextProfile = {
        ...emptyProfile,
        ...current,
        displayName: current.displayName || nextUser.name,
      }
      localStorage.setItem(profileKey, JSON.stringify(nextProfile))
      return nextProfile
    })
    setView(nextUser.role === 'student' ? 'slots' : 'queue')
  }

  const loadSlots = async (currentService = service) => {
    setLoading(true)
    try {
      const data = await request<TimeSlot[]>(`/api/timeslots/available?service_type=${currentService}`)
      setSlots(data)
      setSelectedSlotId(data.find((slot) => slot.booked_count < slot.capacity)?.id ?? data[0]?.id ?? null)
    } catch (error) {
      setNotice(normalizeError(error))
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  const loadMyBookings = async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await request<MyBooking[]>('/api/bookings/my', {}, token)
      setMyBookings(data)
    } catch (error) {
      setNotice(normalizeError(error))
      setMyBookings([])
    } finally {
      setLoading(false)
    }
  }

  const loadAllBookings = async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await request<StaffBooking[]>('/api/bookings/all', {}, token)
      setAllBookings(data)
    } catch (error) {
      setNotice(normalizeError(error))
      setAllBookings([])
    } finally {
      setLoading(false)
    }
  }

  const loadQueue = async (currentService = service) => {
    if (!token) return
    setLoading(true)
    try {
      const data = await request<{ service: ServiceType; queue: QueueItem[]; count: number }>(
        `/api/bookings/queue/${currentService}`,
        {},
        token,
      )
      setQueue(data.queue)
    } catch (error) {
      setNotice(normalizeError(error))
      setQueue([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSlots(service)
  }, [service])

  useEffect(() => {
    if (!user) return
    if (user.role === 'student') void loadMyBookings()
    if (isStaff) void loadQueue(service)
  }, [user, token])

  useEffect(() => {
    if (!user) return
    if (view === 'my') void loadMyBookings()
    if (view === 'queue' && isStaff) void loadQueue(service)
    if (view === 'all' && isStaff) void loadAllBookings()
    if (view === 'manage-slots' && user.role === 'admin') void loadSlots(service)
    if (view === 'analytics' && user.role === 'admin') void loadAllBookings()
  }, [view])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      const data = await request<{
        access_token: string
        user_name: string
        user_role: Role
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })

      saveSession(data.access_token, {
        name: data.user_name,
        email: loginEmail.trim().toLowerCase(),
        role: data.user_role,
      })
      setLoginEmail('')
      setLoginPassword('')
      setNotice('Welcome back. Everything is ready.')
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      const data = await request<{
        access_token: string
        user_name: string
        user_role: Role
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim().toLowerCase(),
          password: registerPassword,
          role: 'student',
        }),
      })

      saveSession(data.access_token, {
        name: data.user_name,
        email: registerEmail.trim().toLowerCase(),
        role: data.user_role,
      })
      setRegisterName('')
      setRegisterEmail('')
      setRegisterPassword('')
      setNotice('Account created. Your student queue dashboard is open.')
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(userKey)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_role')
    setToken(null)
    setUser(null)
    setMyBookings([])
    setAllBookings([])
    setQueue([])
    setView('slots')
    setNotice('You have signed out.')
  }

  const updateProfile = (field: keyof ProfileInfo, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      updateProfile('photo', String(reader.result))
      setNotice('Profile photo selected. Press Save profile to keep it.')
    }
    reader.readAsDataURL(file)
  }

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextProfile = {
      ...profile,
      displayName: profile.displayName.trim() || user?.name || '',
      studentId: profile.studentId.trim(),
      faculty: profile.faculty.trim(),
      group: profile.group.trim(),
      phone: profile.phone.trim(),
      bio: profile.bio.trim(),
    }

    localStorage.setItem(profileKey, JSON.stringify(nextProfile))
    setProfile(nextProfile)

    if (user && nextProfile.displayName !== user.name) {
      const nextUser = { ...user, name: nextProfile.displayName }
      localStorage.setItem(userKey, JSON.stringify(nextUser))
      setUser(nextUser)
    }

    setNotice('Profile updated.')
  }

  const updateSlotForm = (field: keyof SlotForm, value: string) => {
    setSlotForm((current) => ({ ...current, [field]: value }))
  }

  const editSlot = (slot: TimeSlot) => {
    setEditingSlotId(slot.id)
    setSlotForm({
      service_type: slot.service_type,
      start_time: toDateTimeLocal(slot.start_time),
      end_time: toDateTimeLocal(slot.end_time),
      capacity: String(slot.capacity),
    })
    setView('manage-slots')
  }

  const resetSlotForm = () => {
    setEditingSlotId(null)
    setSlotForm({ ...emptySlotForm, service_type: service })
  }

  const saveSlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || user?.role !== 'admin') return

    const payload = {
      service_type: slotForm.service_type,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      capacity: Number(slotForm.capacity),
      is_active: true,
    }

    setLoading(true)
    setNotice(null)
    try {
      await request<TimeSlot>(
        editingSlotId ? `/api/timeslots/${editingSlotId}` : '/api/timeslots/',
        {
          method: editingSlotId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      setService(slotForm.service_type)
      setNotice(editingSlotId ? 'Slot updated.' : 'Slot created.')
      resetSlotForm()
      await loadSlots(slotForm.service_type)
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const deleteSlot = async (slotId: string) => {
    if (!token || user?.role !== 'admin') return

    setLoading(true)
    setNotice(null)
    try {
      await request<{ msg: string }>(`/api/timeslots/${slotId}`, { method: 'DELETE' }, token)
      setNotice('Slot deleted.')
      if (editingSlotId === slotId) resetSlotForm()
      await loadSlots(service)
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const updateAdminUserForm = (field: keyof AdminUserForm, value: string) => {
    setAdminUserForm((current) => ({ ...current, [field]: value } as AdminUserForm))
  }

  const createStaffUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || user?.role !== 'admin') return

    setLoading(true)
    setNotice(null)
    try {
      await request(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(adminUserForm),
        },
        token,
      )
      setAdminUserForm(emptyAdminUserForm)
      setNotice(`${adminUserForm.role} account created.`)
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleBook = async () => {
    if (!token || !user) {
      setNotice('Please sign in before booking a slot.')
      return
    }
    if (user.role !== 'student') {
      setNotice('Only students can create bookings.')
      return
    }
    if (!selectedSlot) {
      setNotice('Choose an available slot first.')
      return
    }

    setLoading(true)
    setNotice(null)
    try {
      const created = await request<MyBooking>(
        '/api/bookings',
        {
          method: 'POST',
          body: JSON.stringify({
            timeslot_id: selectedSlot.id,
            service_type: service,
          }),
        },
        token,
      )
      setNotice(`Booked successfully. Your queue number is ${created.queue_number}.`)
      await Promise.all([loadSlots(service), loadMyBookings()])
      setView('my')
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (bookingId: string) => {
    if (!token) return
    setLoading(true)
    setNotice(null)
    try {
      await request<{ msg: string }>(`/api/bookings/${bookingId}`, { method: 'DELETE' }, token)
      setNotice('Booking cancelled.')
      await Promise.all([loadSlots(service), loadMyBookings()])
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleServe = async (bookingId: string) => {
    if (!token) return
    setLoading(true)
    setNotice(null)
    try {
      await request<{ msg: string }>(`/api/bookings/serve/${bookingId}`, { method: 'POST' }, token)
      setNotice('Booking marked as served.')
      await Promise.all([loadQueue(service), loadAllBookings()])
    } catch (error) {
      setNotice(normalizeError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">CampusFlow</p>
          <h1>SDU campus flow, made lighter.</h1>
          <p className="lead">Book service slots, follow queue numbers, and keep your student profile ready for everyday campus routines.</p>
        </div>

        <div className="account-panel">
          {user ? (
            <>
              <button className="avatar avatar-button" type="button" onClick={() => setView('profile')} aria-label="Open profile">
                {profile.photo ? <img src={profile.photo} alt="" /> : avatarLetter}
              </button>
              <div>
                <strong>{profileName}</strong>
                <small>{user.email} / {user.role}</small>
              </div>
              <button className="icon-button" type="button" onClick={handleLogout} aria-label="Logout">Exit</button>
            </>
          ) : (
            <>
              <span className="avatar">CF</span>
              <div>
                <strong>Guest</strong>
                <small>Sign in to continue</small>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="service-strip" aria-label="Service selector">
        {services.map((item) => (
          <button
            key={item.id}
            className={`service-tab ${service === item.id ? 'active' : ''}`}
            type="button"
            onClick={() => {
              setService(item.id)
              if (isStaff && view === 'queue') void loadQueue(item.id)
            }}
          >
            <span>{item.short}</span>
            {item.title}
          </button>
        ))}
      </section>

      {notice && <div className="notice">{notice}</div>}
      {loading && <div className="loader">Loading live data...</div>}

      {!user ? (
        <section className="auth-layout">
          <div className="auth-copy">
            <span className="capsule">Live Render API</span>
            <h2>One account, three campus services.</h2>
            <p>Students can register and book instantly. Staff and admins log in with issued accounts to manage the active queue.</p>
            <div className="metric-row">
              <div><strong>{slots.length}</strong><span>loaded slots</span></div>
              <div><strong>{serviceLabel(service)}</strong><span>selected service</span></div>
            </div>
          </div>

          <div className="auth-card">
            <div className="switcher">
              <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
              <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Register</button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="form-stack">
                <label>
                  <span>Email</span>
                  <input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="staff@sdu.edu.kz" required />
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="123456" required />
                </label>
                <button className="primary-button" type="submit">Sign in</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="form-stack">
                <label>
                  <span>Name</span>
                  <input value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="Beksultan" required />
                </label>
                <label>
                  <span>SDU email</span>
                  <input type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="student@sdu.edu.kz" required />
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" minLength={6} value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Minimum 6 characters" required />
                </label>
                <button className="primary-button" type="submit">Create student account</button>
              </form>
            )}
          </div>
        </section>
      ) : (
        <>
          <nav className="view-tabs">
            <button className={view === 'profile' ? 'active' : ''} type="button" onClick={() => setView('profile')}>Profile</button>
            {(user.role === 'student' || user.role === 'admin') && <button className={view === 'slots' ? 'active' : ''} type="button" onClick={() => setView('slots')}>Slots</button>}
            {user.role === 'student' && <button className={view === 'my' ? 'active' : ''} type="button" onClick={() => setView('my')}>My bookings</button>}
            {isStaff && <button className={view === 'queue' ? 'active' : ''} type="button" onClick={() => setView('queue')}>Queue</button>}
            {isStaff && <button className={view === 'all' ? 'active' : ''} type="button" onClick={() => setView('all')}>All bookings</button>}
            {user.role === 'admin' && <button className={view === 'manage-slots' ? 'active' : ''} type="button" onClick={() => setView('manage-slots')}>Manage slots</button>}
            {user.role === 'admin' && <button className={view === 'users' ? 'active' : ''} type="button" onClick={() => setView('users')}>Staff users</button>}
            {user.role === 'admin' && <button className={view === 'analytics' ? 'active' : ''} type="button" onClick={() => setView('analytics')}>Analytics</button>}
          </nav>

          {view === 'profile' && (
            <section className="profile-layout">
              <aside className="panel profile-card">
                <div className="profile-cover" />
                <div className="profile-photo">
                  {profile.photo ? <img src={profile.photo} alt="Profile" /> : <span>{avatarLetter}</span>}
                </div>
                <h2>{profileName}</h2>
                <p>{user.email}</p>
                <div className="profile-tags">
                  <span>{user.role}</span>
                  <span>{profile.studentId || 'Student ID'}</span>
                </div>
                <div className="profile-stats">
                  <div><strong>{myBookings.length}</strong><span>bookings</span></div>
                  <div><strong>{myBookings.filter((booking) => booking.status === 'active').length}</strong><span>active</span></div>
                </div>
              </aside>

              <form className="panel profile-form" onSubmit={saveProfile}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Personal profile</p>
                    <h2>Student information</h2>
                  </div>
                  <button className="primary-button compact" type="submit">Save profile</button>
                </div>

                <div className="photo-control">
                  <div>
                    <strong>Profile photo</strong>
                    <small>Upload a square photo for the top bar and profile card.</small>
                  </div>
                  <label className="upload-button">
                    Choose photo
                    <input type="file" accept="image/*" onChange={handlePhotoChange} />
                  </label>
                </div>

                <div className="profile-fields">
                  <label>
                    <span>Full name</span>
                    <input value={profile.displayName} onChange={(event) => updateProfile('displayName', event.target.value)} placeholder={user.name} />
                  </label>
                  <label>
                    <span>Student ID</span>
                    <input value={profile.studentId} onChange={(event) => updateProfile('studentId', event.target.value)} placeholder="23B030123" />
                  </label>
                  <label>
                    <span>Faculty / school</span>
                    <input value={profile.faculty} onChange={(event) => updateProfile('faculty', event.target.value)} placeholder="School of IT and Applied Mathematics" />
                  </label>
                  <label>
                    <span>Group</span>
                    <input value={profile.group} onChange={(event) => updateProfile('group', event.target.value)} placeholder="SE-2301" />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} placeholder="+7 777 000 00 00" />
                  </label>
                  <label className="full-field">
                    <span>About student</span>
                    <textarea value={profile.bio} onChange={(event) => updateProfile('bio', event.target.value)} rows={4} placeholder="Short note about study, schedule, or campus preferences" />
                  </label>
                </div>
              </form>
            </section>
          )}

          {view === 'slots' && (
            <section className="content-grid">
              <div className="panel wide">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{serviceLabel(service)}</p>
                    <h2>Available slots</h2>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => void loadSlots()}>Refresh</button>
                </div>

                <div className="slot-list">
                  {slots.map((slot) => {
                    const full = slot.booked_count >= slot.capacity
                    return (
                      <button
                        key={slot.id}
                        className={`slot-row ${selectedSlotId === slot.id ? 'selected' : ''}`}
                        type="button"
                        disabled={full}
                        onClick={() => setSelectedSlotId(slot.id)}
                      >
                        <span>
                          <strong>{formatDateTime(slot.start_time)}</strong>
                          <small>{formatTimeRange(slot)}</small>
                        </span>
                        <em>{slot.booked_count}/{slot.capacity}</em>
                      </button>
                    )
                  })}
                  {!slots.length && <div className="empty">No slots returned for this service yet.</div>}
                </div>
              </div>

              <aside className="panel booking-panel">
                <p className="eyebrow">Booking</p>
                <h2>{selectedSlot ? formatDateTime(selectedSlot.start_time) : 'Select a slot'}</h2>
                <p>{selectedSlot ? `${serviceLabel(service)} / ${formatTimeRange(selectedSlot)}` : 'Choose a service time to continue.'}</p>
                <div className="capacity-line">
                  <span>Capacity</span>
                  <strong>{selectedSlot ? `${selectedSlot.booked_count}/${selectedSlot.capacity}` : '-'}</strong>
                </div>
                <button className="primary-button" type="button" onClick={() => void handleBook()} disabled={!selectedSlot || user.role !== 'student'}>
                  Book this slot
                </button>
                {user.role !== 'student' && <small className="muted">Staff and admins can view slots, but only students can book.</small>}
              </aside>
            </section>
          )}

          {view === 'my' && user.role === 'student' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Student</p>
                  <h2>My bookings</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadMyBookings()}>Refresh</button>
              </div>
              <div className="table-like">
                {myBookings.map((booking) => {
                  const slot = slotById.get(booking.timeslot_id)
                  return (
                    <article key={booking.id} className="booking-row">
                      <span className="queue-number">#{booking.queue_number}</span>
                      <div>
                        <strong>{slot ? `${serviceLabel(slot.service_type)} / ${formatDateTime(slot.start_time)}` : booking.timeslot_id}</strong>
                        <small>Created {formatDateTime(booking.created_at)}</small>
                      </div>
                      <span className={`status ${booking.status}`}>{statusLabel[booking.status]}</span>
                      {booking.status === 'active' && (
                        <button className="secondary-button danger" type="button" onClick={() => void handleCancel(booking.id)}>Cancel</button>
                      )}
                    </article>
                  )
                })}
                {!myBookings.length && <div className="empty">No bookings yet. Pick a slot and your queue number will appear here.</div>}
              </div>
            </section>
          )}

          {view === 'queue' && isStaff && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{serviceLabel(service)}</p>
                  <h2>Today&apos;s active queue</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadQueue()}>Refresh</button>
              </div>
              <div className="queue-grid">
                {queue.map((item) => (
                  <article className="queue-card" key={item.booking_id}>
                    <span className="queue-number">#{item.queue_number}</span>
                    <div>
                      <strong>{item.student_name}</strong>
                      <small>{item.timeslot_id}</small>
                    </div>
                    <button className="primary-button compact" type="button" onClick={() => void handleServe(item.booking_id)}>Served</button>
                  </article>
                ))}
                {!queue.length && <div className="empty">Queue is clear for {serviceLabel(service)}.</div>}
              </div>
            </section>
          )}

          {view === 'manage-slots' && user.role === 'admin' && (
            <section className="admin-grid">
              <form className="panel admin-form" onSubmit={saveSlot}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h2>{editingSlotId ? 'Edit slot' : 'Create slot'}</h2>
                  </div>
                  {editingSlotId && <button className="secondary-button" type="button" onClick={resetSlotForm}>New slot</button>}
                </div>

                <div className="profile-fields">
                  <label>
                    <span>Service</span>
                    <select value={slotForm.service_type} onChange={(event) => updateSlotForm('service_type', event.target.value)}>
                      {services.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Capacity</span>
                    <input type="number" min="1" value={slotForm.capacity} onChange={(event) => updateSlotForm('capacity', event.target.value)} required />
                  </label>
                  <label>
                    <span>Start time</span>
                    <input type="datetime-local" value={slotForm.start_time} onChange={(event) => updateSlotForm('start_time', event.target.value)} required />
                  </label>
                  <label>
                    <span>End time</span>
                    <input type="datetime-local" value={slotForm.end_time} onChange={(event) => updateSlotForm('end_time', event.target.value)} required />
                  </label>
                </div>

                <button className="primary-button full-button" type="submit">{editingSlotId ? 'Save changes' : 'Create slot'}</button>
              </form>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{serviceLabel(service)}</p>
                    <h2>Slot list</h2>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => void loadSlots()}>Refresh</button>
                </div>
                <div className="table-like">
                  {slots.map((slot) => (
                    <article className="booking-row admin-row" key={slot.id}>
                      <span className="queue-number">{slot.booked_count}/{slot.capacity}</span>
                      <div>
                        <strong>{formatDateTime(slot.start_time)}</strong>
                        <small>{serviceLabel(slot.service_type)} / {formatTimeRange(slot)}</small>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => editSlot(slot)}>Edit</button>
                      <button className="secondary-button danger" type="button" onClick={() => void deleteSlot(slot.id)}>Delete</button>
                    </article>
                  ))}
                  {!slots.length && <div className="empty">No slots for {serviceLabel(service)} yet.</div>}
                </div>
              </section>
            </section>
          )}

          {view === 'users' && user.role === 'admin' && (
            <section className="admin-grid">
              <form className="panel admin-form" onSubmit={createStaffUser}>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Admin</p>
                    <h2>Create staff/admin</h2>
                  </div>
                </div>
                <div className="profile-fields">
                  <label>
                    <span>Name</span>
                    <input value={adminUserForm.name} onChange={(event) => updateAdminUserForm('name', event.target.value)} placeholder="Aizhan" required />
                  </label>
                  <label>
                    <span>Role</span>
                    <select value={adminUserForm.role} onChange={(event) => updateAdminUserForm('role', event.target.value)}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={adminUserForm.email} onChange={(event) => updateAdminUserForm('email', event.target.value)} placeholder="staff@sdu.edu.kz" required />
                  </label>
                  <label>
                    <span>Password</span>
                    <input type="password" minLength={6} value={adminUserForm.password} onChange={(event) => updateAdminUserForm('password', event.target.value)} placeholder="Minimum 6 characters" required />
                  </label>
                </div>
                <button className="primary-button full-button" type="submit">Create account</button>
              </form>

              <aside className="panel rules-panel">
                <p className="eyebrow">Role model</p>
                <h2>Access rules</h2>
                <div className="rules-list">
                  <div><strong>Staff</strong><span>Queue, served button, all bookings.</span></div>
                  <div><strong>Admin</strong><span>Staff tools plus slot management and user creation.</span></div>
                  <div><strong>Student</strong><span>Registration, booking, own booking history.</span></div>
                </div>
              </aside>
            </section>
          )}

          {view === 'analytics' && user.role === 'admin' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Admin</p>
                  <h2>Booking analytics</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadAllBookings()}>Refresh</button>
              </div>
              <div className="analytics-grid">
                <div><strong>{bookingStats.total}</strong><span>Total bookings</span></div>
                <div><strong>{bookingStats.active}</strong><span>Active</span></div>
                <div><strong>{bookingStats.completed}</strong><span>Completed</span></div>
                <div><strong>{bookingStats.cancelled}</strong><span>Cancelled</span></div>
              </div>
              <div className="rules-list analytics-note">
                {services.map((item) => (
                  <div key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{service === item.id ? slots.length : 'Switch service to load slots'} visible slots in current service view.</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === 'all' && isStaff && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Staff</p>
                  <h2>All bookings</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadAllBookings()}>Refresh</button>
              </div>
              <div className="table-like">
                {allBookings.map((booking) => (
                  <article key={booking.id} className="booking-row">
                    <span className="queue-number">#{booking.queue ?? booking.queue_number ?? '-'}</span>
                    <div>
                      <strong>{booking.slot ?? booking.timeslot_id ?? booking.id}</strong>
                      <small>{booking.id}</small>
                    </div>
                    <span className={`status ${booking.status}`}>{statusLabel[booking.status]}</span>
                    {booking.status === 'active' && (
                      <button className="primary-button compact" type="button" onClick={() => void handleServe(booking.id)}>Served</button>
                    )}
                    {user.role === 'admin' && booking.status === 'active' && (
                      <button className="secondary-button danger" type="button" onClick={() => void handleCancel(booking.id)}>Cancel</button>
                    )}
                  </article>
                ))}
                {!allBookings.length && <div className="empty">No bookings returned by the backend.</div>}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default App
