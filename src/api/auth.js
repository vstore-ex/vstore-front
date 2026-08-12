const API_BASE_URL = 'https://vstore-backend.lemonbush-87bea63a.italynorth.azurecontainerapps.io/api/v1/'

function getApiMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || item.message || String(item)).join(' ')
  }

  return fallback
}

export async function registerUser(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(getApiMessage(data, 'Registration failed.'))
  }

  return {
    data,
    message: getApiMessage(data, 'Account created successfully. You can sign in now.'),
  }
}

export async function loginUser(payload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(getApiMessage(data, 'Login failed.'))
  }

  return {
    data,
    message: getApiMessage(data, 'Signed in successfully.'),
  }
}
