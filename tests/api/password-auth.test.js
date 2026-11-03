import { expect, test, vi } from 'vitest'
import { changePassword, requestPasswordReset, registrationErrors } from '../../src/api/auth'
import { resetSession } from '../../src/api/client'
import { jsonResponse } from '../helpers'

test('password reset request uses the public API without credentials and keeps the response generic', async () => {
  localStorage.setItem('vstore:token', 'private')
  const message = 'If an account exists for this address, reset instructions have been sent.'
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ message }, 202)),
  )

  expect(await requestPasswordReset(' player@example.com ')).toBe(message)
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/auth/password/forgot')
  expect(options.method).toBe('POST')
  expect(options.credentials).toBe('omit')
  expect(options.headers.Authorization).toBeUndefined()
  expect(JSON.parse(options.body)).toEqual({ email: 'player@example.com' })
})

test('password change sends both passwords to the authenticated endpoint', async () => {
  resetSession()
  localStorage.setItem('vstore:token', 'session-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ message: 'Password changed.' })),
  )

  await changePassword({
    current_password: 'current-secret',
    new_password: 'new-secret-long-enough',
  })

  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/auth/password/change')
  expect(options.method).toBe('POST')
  expect(options.headers.Authorization).toBe('Bearer session-token')
  expect(JSON.parse(options.body)).toEqual({
    current_password: 'current-secret',
    new_password: 'new-secret-long-enough',
  })
})

test('server-reported breached-password errors are attached to the password field', () => {
  expect(
    registrationErrors({ status: 422, message: 'password has appeared in a data breach' }),
  ).toEqual({ password: 'password has appeared in a data breach' })
})
