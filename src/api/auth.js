import { apiRequest, refreshSession, validationErrors, waitForRefresh } from './client'

export function normalizeUser(data) {
  if (!data) return null

  return {
    id: data.id ?? null,
    username: data.username ?? '',
    email: data.email ?? '',
    ...(typeof data.email_verified === 'boolean' ? { emailVerified: data.email_verified } : {}),
    ...('pending_email' in data ? { pendingEmail: data.pending_email || null } : {}),
    ...('email_verification_sent' in data
      ? { emailVerificationSent: data.email_verification_sent }
      : {}),
    role: data.role ?? data.role_name ?? 'User',
    permissions: data.permissions ?? null,
    avatar: data.avatar ?? null,
    fullName: data.full_name ?? '',
    phone: data.phone ?? '',
    stats: data.stats ?? {},
  }
}

export async function registerUser(payload, signal) {
  const data = await apiRequest('/auth/register/', {
    method: 'POST',
    body: payload,
    auth: false,
    signal,
  })
  return { data, message: 'Confirm your email before signing in.' }
}
export async function resendVerification(email, signal) {
  const data = await apiRequest('/auth/resend-verification', {
    method: 'POST',
    body: { email: email.trim() },
    auth: false,
    credentials: 'omit',
    signal,
  })
  if (typeof data?.message !== 'string' || !data.message.trim())
    throw new Error('Could not confirm the resend request. Please try again.')
  return data.message
}
export async function requestPasswordReset(email, signal) {
  const data = await apiRequest('/auth/password/forgot', {
    method: 'POST',
    body: { email: email.trim() },
    auth: false,
    credentials: 'omit',
    signal,
  })
  if (typeof data?.message !== 'string' || !data.message.trim()) {
    throw new Error('Could not confirm the password reset request. Please try again.')
  }
  return data.message
}
export async function changePassword(payload, signal) {
  return apiRequest('/auth/password/change', {
    method: 'POST',
    body: payload,
    signal,
  })
}
export function isUnverifiedLogin(error) {
  return error.status === 403 && /email not confirmed/i.test(error.message)
}
export async function loginUser(payload) {
  await waitForRefresh()
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: new URLSearchParams(payload),
    auth: false,
  })
  if (res?.access_token) {
    try {
      localStorage.setItem('vstore:token', res.access_token)
    } catch {
      /* storage disabled */
    }
  }
  return { data: await getCurrentUser(), message: 'Signed in successfully.' }
}
export async function getCurrentUser() {
  const data = await apiRequest('/users/me')
  if (data?.id == null || typeof data.username !== 'string')
    throw new Error('The server returned an invalid account.')
  return normalizeUser(data)
}
export const refreshUser = refreshSession
export async function logoutUser(all = false) {
  await waitForRefresh()
  // logout-all requires a valid access cookie to revoke the other devices.
  if (all) await refreshSession()
  try {
    await apiRequest(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST', auth: false })
  } finally {
    try {
      localStorage.removeItem('vstore:token')
    } catch {
      /* storage disabled */
    }
  }
}
export async function updateUser(body, signal) {
  return normalizeUser(await apiRequest('/users/me', { method: 'PATCH', body, signal }))
}
export async function updateAvatar(file, signal) {
  const body = new FormData()
  body.append('file', file)
  return normalizeUser(
    await apiRequest('/users/me/avatar', { method: 'PATCH', body, signal, timeout: 120000 }),
  )
}
export function registrationErrors(error) {
  for (const source of [error.errors, error.detail]) {
    const fields = validationErrors(source)
      .map((item) => [
        item.field ?? (Array.isArray(item.loc) ? item.loc.at(-1) : null),
        item.message,
      ])
      .filter(([field]) => ['username', 'email', 'password'].includes(field))
    if (fields.length) return Object.fromEntries(fields)
  }
  if (error.status !== 400 && error.status !== 422) return {}
  if (/email/i.test(error.message)) return { email: error.message }
  if (/username/i.test(error.message)) return { username: error.message }
  if (/password/i.test(error.message)) return { password: error.message }
  if (/already exists/i.test(error.message))
    return {
      username: 'Username or email already exists.',
      email: 'Username or email already exists.',
    }
  return {}
}

export async function getGoogleAuthorizationUrl() {
  const data = await apiRequest('/auth/google/login?redirect=false', { auth: false })
  let url
  try {
    url = new URL(data?.authorization_url)
  } catch {
    throw new Error('Google sign-in is unavailable. Please try again.')
  }
  if (
    url.origin !== 'https://accounts.google.com' ||
    url.pathname !== '/o/oauth2/v2/auth' ||
    !data?.state ||
    url.searchParams.get('state') !== data.state
  ) {
    throw new Error('Google sign-in is unavailable. Please try again.')
  }
  return url.href
}
