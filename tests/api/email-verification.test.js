import { expect, test, vi } from 'vitest'
import { getCurrentUser, isUnverifiedLogin, loginUser, registerUser, resendVerification, updateUser } from '../../src/api/auth'
import { resetSession } from '../../src/api/client'
import { jsonResponse } from '../helpers'

test('signup preserves the backend delivery result and never claims login is immediately available', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ email: 'player@example.com', email_sent: false }, 201)))
  const result = await registerUser({ email: 'player@example.com', username: 'player', password: 'secret123' })
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/auth/register/')
  expect(result.data.email_sent).toBe(false)
  expect(result.message).toBe('Confirm your email before signing in.')
})

test('resend uses the public endpoint without auth and returns the generic response unchanged', async () => {
  localStorage.setItem('vstore:token', 'private')
  const message = 'If an account needs verification, a confirmation email has been sent.'
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message }, 202)))
  const controller = new AbortController()
  expect(await resendVerification(' player@example.com ', controller.signal)).toBe(message)
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/auth/resend-verification')
  expect(options.method).toBe('POST')
  expect(options.credentials).toBe('omit')
  expect(options.headers.Authorization).toBeUndefined()
  expect(JSON.parse(options.body)).toEqual({ email: 'player@example.com' })
  controller.abort()
  expect(options.signal.aborted).toBe(true)
})

test('unverified login neither expires an authenticated session nor refreshes tokens', async () => {
  resetSession()
  const expired = vi.fn(), banned = vi.fn()
  window.addEventListener('vstore:session-expired', expired)
  window.addEventListener('vstore:account-banned', banned)
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ detail: 'Email not confirmed. Open the link we sent.' }, 403)))
  try {
    const error = await loginUser({ username: 'player', password: 'secret123' }).catch(error => error)
    expect(isUnverifiedLogin(error)).toBe(true)
    expect(expired).not.toHaveBeenCalled()
    expect(banned).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  } finally {
    window.removeEventListener('vstore:session-expired', expired)
    window.removeEventListener('vstore:account-banned', banned)
  }
})

test('current account and profile updates retain active and pending email verification fields', async () => {
  const data = { id: 7, username: 'player', email: 'active@example.com', pending_email: 'pending@example.com', email_verified: true, email_verification_sent: false }
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(data)))
  for (const user of [await getCurrentUser(), await updateUser({ email: 'pending@example.com' })]) {
    expect(user).toMatchObject({ email: 'active@example.com', pendingEmail: 'pending@example.com', emailVerified: true, emailVerificationSent: false })
  }
})

test('malformed resend responses do not display a success message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: null })))
  await expect(resendVerification('player@example.com')).rejects.toThrow('Could not confirm the resend request')
})
