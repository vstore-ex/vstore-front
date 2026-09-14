// Relative API path (/api/v1) for same-origin reverse-proxied production & dev
const DEFAULT_API_BASE_URL = '/api/v1'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

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

function normalizeUser(data) {
  if (!data) return null

  return {
    id: data.id ?? null,
    username: data.username ?? '',
    email: data.email ?? '',
    role: data.role ?? data.role_name ?? 'User',
    permissions: data.permissions ?? null,
  }
}

export async function registerUser(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  const data = await parseApiResponse(response)

  if (!response.ok) {
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

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: formData,
  })
  const data = await parseApiResponse(response)

  if (!response.ok) {
    throw new Error(getApiMessage(data, 'Login failed.'))
  }

  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Signed in, but the session cookie was not received.')
  }

  return {
    data: user,
    message: getApiMessage(data, 'Signed in successfully.'),
  }
}

export async function getCurrentUser() {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    credentials: 'include',
  })

  if (!response.ok) {
    return null
  }

  const data = await parseApiResponse(response)
  return normalizeUser(data)
}

export async function logoutUser() {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(getApiMessage(data, 'Logout failed.'))
  }
}
