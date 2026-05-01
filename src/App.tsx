import { useEffect, useState } from 'react'
import './App.css'

type User = {
  id: string
  name: string
  email: string
  role: 'student' | 'staff' | 'admin'
}

type TimeSlot = {
  id: string
  start_time: string
  end_time: string
  service_type: string
  capacity: number
  booked_count: number
}

type Booking = {
  id: string
  timeslot_id: string
  queue_number: number
  status: string
  created_at: string
}

const BASE_URL = 'https://campusflow-backend-ra0h.onrender.com'
const API = {
  auth: `${BASE_URL}/api/auth`,
  timeslots: `${BASE_URL}/api/timeslots`,
  bookings: `${BASE_URL}/api/bookings`,
}

function App() {
  const [view, setView] = useState<'login' | 'register' | 'slots' | 'mybookings' | 'admin'>('login')
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState('')

  // Формы
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  // Данные
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [studentId, setStudentId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Проверяем токен при загрузке
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      setView('slots')
    }
  }, [])

  const showMessage = (msg: string, isError = true) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API.auth}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      })
      if (!res.ok) throw new Error('Неверный email или пароль')
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify({
        name: data.user_name,
        email: loginEmail,
        role: data.user_role
      }))
      setToken(data.access_token)
      setUser({ id: '', name: data.user_name, email: loginEmail, role: data.user_role })
      setView('slots')
      setLoginEmail('')
      setLoginPassword('')
      showMessage('Добро пожаловать!', false)
    } catch (err: any) {
      showMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API.auth}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, role: 'student' })
      })
      if (!res.ok) throw new Error('Ошибка регистрации')
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify({
        name: data.user_name,
        email: regEmail,
        role: 'student'
      }))
      setToken(data.access_token)
      setUser({ id: '', name: data.user_name, email: regEmail, role: 'student' })
      setView('slots')
      setRegName('')
      setRegEmail('')
      setRegPassword('')
      showMessage('Регистрация успешна!', false)
    } catch (err: any) {
      showMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setToken('')
    setView('login')
    showMessage('Вы вышли из системы', false)
  }

  const loadSlots = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API.timeslots}/available?service_type=cafe`)
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      setSlots(data)
    } catch (err) {
      showMessage('Не удалось загрузить слоты')
    } finally {
      setLoading(false)
    }
  }

  const loadMyBookings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API.bookings}/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Ошибка загрузки')
      const data = await res.json()
      setBookings(data)
    } catch (err) {
      showMessage('Не удалось загрузить брони')
    } finally {
      setLoading(false)
    }
  }

  const createBooking = async () => {
    if (!selectedSlot) {
      showMessage('Выберите время')
      return
    }
    if (!studentId.trim()) {
      showMessage('Введите Student ID')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(API.bookings, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          timeslot_id: selectedSlot.id,
          service_type: 'cafe'
        })
      })
      if (!res.ok) throw new Error('Ошибка бронирования')
      const data = await res.json()
      showMessage(`Забронировано! Номер в очереди: ${data.queue_number}`, false)
      setSelectedSlot(null)
      setStudentId('')
      loadSlots()
    } catch (err) {
      showMessage('Не удалось забронировать')
    } finally {
      setLoading(false)
    }
  }

  const cancelBooking = async (bookingId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API.bookings}/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Ошибка отмены')
      showMessage('Бронь отменена', false)
      loadMyBookings()
      loadSlots()
    } catch (err) {
      showMessage('Не удалось отменить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (view === 'slots' && token) {
      loadSlots()
    }
    if (view === 'mybookings' && token) {
      loadMyBookings()
    }
  }, [view, token])

  // Форматирование времени
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })

  // Если не залогинен
  if (!user) {
    return (
      <div className="container">
        <h1>🎓 CampusFlow</h1>
        <p>Система управления очередями в университете</p>

        {message && <div className="message error">{message}</div>}

        <div className="tabs">
          <button className={view === 'login' ? 'active' : ''} onClick={() => setView('login')}>Вход</button>
          <button className={view === 'register' ? 'active' : ''} onClick={() => setView('register')}>Регистрация</button>
        </div>

        {view === 'login' && (
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email (@sdu.edu.kz)" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            <input type="password" placeholder="Пароль" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
            <button type="submit" disabled={loading}>Войти</button>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister}>
            <input type="text" placeholder="ФИО" value={regName} onChange={e => setRegName(e.target.value)} required />
            <input type="email" placeholder="Email (@sdu.edu.kz)" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
            <input type="password" placeholder="Пароль (мин. 6 символов)" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
            <button type="submit" disabled={loading}>Зарегистрироваться</button>
          </form>
        )}
      </div>
    )
  }

  // Студент
  return (
    <div className="container">
      <div className="header">
        <h1>🎓 CampusFlow</h1>
        <div className="user-info">
          <span>{user.name}</span>
          <button onClick={handleLogout}>Выйти</button>
        </div>
      </div>

      {message && <div className="message success">{message}</div>}

      <div className="tabs">
        <button className={view === 'slots' ? 'active' : ''} onClick={() => setView('slots')}>📅 Слоты</button>
        <button className={view === 'mybookings' ? 'active' : ''} onClick={() => setView('mybookings')}>✅ Мои брони</button>
        {(user.role === 'staff' || user.role === 'admin') && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>👥 Очередь</button>
        )}
      </div>

      {/* Слоты */}
      {view === 'slots' && (
        <div>
          <h2>Доступные слоты</h2>
          {loading && <div className="loading">Загрузка...</div>}
          <div className="slots-list">
            {slots.map(slot => (
              <div key={slot.id} className={`slot-card ${selectedSlot?.id === slot.id ? 'selected' : ''}`} onClick={() => setSelectedSlot(slot)}>
                <div className="slot-time">{formatDate(slot.start_time)} {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</div>
                <div className="slot-info">Свободно: {slot.capacity - slot.booked_count} из {slot.capacity}</div>
              </div>
            ))}
          </div>

          {selectedSlot && (
            <div className="booking-form">
              <h3>Бронирование</h3>
              <p>Время: {formatDate(selectedSlot.start_time)} {formatTime(selectedSlot.start_time)}</p>
              <input type="text" placeholder="Student ID" value={studentId} onChange={e => setStudentId(e.target.value)} />
              <button onClick={createBooking} disabled={loading}>Забронировать</button>
            </div>
          )}
        </div>
      )}

      {/* Мои брони */}
      {view === 'mybookings' && (
        <div>
          <h2>Мои бронирования</h2>
          {loading && <div className="loading">Загрузка...</div>}
          {bookings.length === 0 && !loading && <p>У вас пока нет броней</p>}
          <div className="bookings-list">
            {bookings.map(booking => {
              const slot = slots.find(s => s.id === booking.timeslot_id)
              return (
                <div key={booking.id} className="booking-card">
                  <div className="booking-queue">Номер в очереди: #{booking.queue_number}</div>
                  <div className="booking-time">{slot ? `${formatDate(slot.start_time)} ${formatTime(slot.start_time)}` : 'Время неизвестно'}</div>
                  <div className="booking-status">Статус: {booking.status === 'active' ? 'Активна' : booking.status}</div>
                  <button onClick={() => cancelBooking(booking.id)} disabled={loading}>Отменить</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Админ панель */}
      {view === 'admin' && (user.role === 'staff' || user.role === 'admin') && (
        <div>
          <h2>Очередь (Staff)</h2>
          <div className="bookings-list">
            {bookings.filter(b => b.status === 'active').map(booking => {
              const slot = slots.find(s => s.id === booking.timeslot_id)
              return (
                <div key={booking.id} className="booking-card">
                  <div className="booking-queue">#{booking.queue_number}</div>
                  <div className="booking-time">{slot ? `${formatDate(slot.start_time)} ${formatTime(slot.start_time)}` : 'Время неизвестно'}</div>
                  <button onClick={() => cancelBooking(booking.id)}>Обслужен</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default App