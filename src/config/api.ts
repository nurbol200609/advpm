// API Configuration for UniQueue Frontend
// This file centralizes all API-related constants and utilities

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'https://advpm.onrender.com'

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  register: '/api/auth/register',
  login: '/api/auth/login',
  logout: '/api/auth/logout',

  // Time slots
  timeslots: '/api/timeslots/available',

  // Bookings
  bookings: '/api/bookings',

  // Health check
  health: '/health',

  // Staff endpoints (if available)
  staffQueue: '/api/staff/queue',
  staffCallNext: '/api/staff/call-next',
  staffComplete: '/api/staff/complete',

  // Analytics (if available)
  analytics: '/api/analytics',
}

// Helper function to build full API URL
export const buildApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  return `${API_BASE_URL}${endpoint}`
}

// JWT Token management
export const TOKEN_KEY = 'uqs-jwt-token'

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export const setStoredToken = (token: string | null): void => {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(TOKEN_KEY)
  }
}

export const clearStoredToken = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
}

// API Request helper with JWT authentication
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const url = buildApiUrl(endpoint)
  const token = getStoredToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const devMode = import.meta.env.DEV
  const method = (options.method || 'GET').toUpperCase()
  
  if (devMode) {
    console.info(`[apiRequest] ${method} ${url} -> sending`)
    console.debug(`[apiRequest] body:`, options.body)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (error) {
    // Network error (including CORS)
    const errorMsg = error instanceof Error ? error.message : 'Unknown network error'
    if (devMode) {
      console.error(`[apiRequest] ${method} ${url} -> NETWORK ERROR`, errorMsg)
    }
    
    // Detect CORS errors
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('CORS')) {
      throw new Error('Backend connection failed. Please check CORS or API URL.')
    }
    throw new Error(`Network error: ${errorMsg}`)
  }

  if (devMode) {
    console.info(`[apiRequest] ${method} ${url} -> ${response.status} ${response.statusText}`)
  }

  if (!response.ok) {
    // Try to parse error message from response
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      // Handle FastAPI validation errors (detail can be string or array)
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // Validation error array
          const validationMsgs = errorData.detail.map((err: any) => 
            `${err.loc?.join('.')}: ${err.msg}`
          ).join('; ')
          errorMessage = validationMsgs || 'Validation failed'
        } else {
          errorMessage = errorData.detail
        }
      } else {
        errorMessage = errorData.message || errorMessage
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (response.status === 401) {
      errorMessage = 'Session expired. Please log in again.'
    } else if (response.status === 403) {
      errorMessage = 'You do not have permission to view this page.'
    } else if (response.status === 409) {
      errorMessage = 'This email is already registered.'
    }

    if (devMode) {
      console.warn(`[apiRequest] ${method} ${url} -> ERROR`, errorMessage)
    }

    throw new Error(errorMessage)
  }

  return response.json()
}

// Legacy fetchJson for backward compatibility (will be removed)
export const fetchJson = apiRequest