const DEFAULT_API_BASE_URL =
  'https://vstore-backend.lemonbush-87bea63a.italynorth.azurecontainerapps.io/api/v1'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')
const AUTH_SESSION_STORAGE_KEY = 'vstore:authSession'

function getApiMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || item.message || String(item)).join(' ')
  }

  return fallback
}

async function parseApiResponse(response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function isRetryableRouteMismatch(response) {
  return response.status === 404 || response.status === 405 || response.status === 307
}

function normalizeUser(data, fallback = {}) {
  if (!data) return null

  return {
    id: data.id ?? fallback.id ?? null,
    username: data.username ?? fallback.username ?? '',
    email: data.email ?? fallback.email ?? '',
    role: data.role ?? data.role_name ?? fallback.role ?? fallback.role_name ?? 'User',
    permissions: data.permissions ?? fallback.permissions ?? null,
  }
}

function storeAuthSession(user) {
  if (!user?.username) return
  localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      user,
      storedAt: new Date().toISOString(),
    }),
  )
}

export function clearStoredAuthSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

export function getStoredAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY))
    return normalizeUser(session?.user)
  } catch {
    clearStoredAuthSession()
    return null
  }
}

export async function registerUser(payload) {
  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }
  let finalResponse
  let data

  try {
    finalResponse = await fetch(`${API_BASE_URL}/auth/register`, requestOptions)
    data = await parseApiResponse(finalResponse)
  } catch (error) {
    finalResponse = null
    data = { message: error.message }
  }

  if (!finalResponse || isRetryableRouteMismatch(finalResponse)) {
    finalResponse = await fetch(`${API_BASE_URL}/auth/register/`, {
      ...requestOptions,
      body: JSON.stringify(payload),
    })
    data = await parseApiResponse(finalResponse)
  }

  if (!finalResponse.ok) {
    throw new Error(getApiMessage(data, 'Registration failed.'))
  }

  return {
    data,
    message: getApiMessage(data, 'Account created successfully. You can sign in now.'),
  }
}

export async function loginUser(payload) {
  const formData = new URLSearchParams()
  formData.set('username', payload.username)
  formData.set('password', payload.password)

  let usedJsonFallback = false
  let response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: formData,
  })
  let data = await parseApiResponse(response)

  if (response.status === 422) {
    usedJsonFallback = true
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
      }),
    })
    data = await parseApiResponse(response)
  }

  if (!response.ok) {
    clearStoredAuthSession()
    throw new Error(getApiMessage(data, 'Login failed.'))
  }

  const currentUser = usedJsonFallback
    ? null
    : await getCurrentUser({ allowStoredFallback: false }).catch(() => null)
  const user = currentUser || normalizeUser(data, payload)

  if (user) {
    storeAuthSession(user)
  }

  return {
    data: user || data,
    message: getApiMessage(data, 'Signed in successfully.'),
  }
}

export async function getCurrentUser({ allowStoredFallback = true } = {}) {
  const response = await fetch(`${API_BASE_URL}/me`, {
    credentials: 'include',
  })

  if (!response.ok) {
    return allowStoredFallback ? getStoredAuthSession() : null
  }

  const data = await parseApiResponse(response)
  const user = normalizeUser(data)
  storeAuthSession(user)

  return user
}

export async function logoutUser() {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  clearStoredAuthSession()

  if (!response.ok && response.status !== 404 && response.status !== 405) {
    const data = await response.json().catch(() => null)
    throw new Error(getApiMessage(data, 'Logout failed.'))
  }
}
