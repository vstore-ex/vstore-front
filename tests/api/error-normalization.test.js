import { beforeEach, expect, test, vi } from 'vitest'
import { apiRequest, ApiError } from '../../src/api/client'
import { registrationErrors } from '../../src/api/auth'
import { jsonResponse } from '../helpers'

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

test('keeps readable validation errors and diagnostics when the response contains invalid entries', async () => {
  const problem = {
    errors: [
      null,
      17,
      'invalid',
      {},
      { message: {} },
      { field: 'email', message: '  Invalid email  ' },
      { field: 'username', msg: 'Name is taken' },
    ],
    request_id: 'validation-17',
  }
  fetchMock.mockResolvedValue(jsonResponse(problem, 422))
  const error = await apiRequest('/auth/register/', {
    method: 'POST',
    body: {},
    auth: false,
  }).catch((reason) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({
    status: 422,
    message: 'Invalid email. Name is taken',
    requestId: 'validation-17',
    problem,
  })
  expect(registrationErrors(error)).toEqual({ email: 'Invalid email', username: 'Name is taken' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('reads FastAPI field errors without crashing on null entries or invalid locations', async () => {
  fetchMock.mockResolvedValue(
    jsonResponse(
      {
        detail: [
          null,
          { loc: {}, msg: 'Form is invalid' },
          { loc: ['body', 'password'], msg: '  Too short  ' },
        ],
      },
      422,
    ),
  )
  const error = await apiRequest('/auth/register/', { auth: false }).catch((reason) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(error.message).toBe('Form is invalid Too short')
  expect(registrationErrors(error)).toEqual({ password: 'Too short' })
})

test.each([
  [{ errors: [null, {}], detail: 'Try again later' }, 'Try again later'],
  [{ errors: [{ message: {} }], detail: [{ msg: 'Service unavailable' }] }, 'Service unavailable'],
  [
    { errors: [{ message: '   ' }], detail: {}, message: '  Temporarily unavailable  ' },
    'Temporarily unavailable',
  ],
  [{ detail: [], message: 'Request rejected' }, 'Request rejected'],
  [
    { errors: [null, {}, { message: ['invalid'] }], detail: {} },
    'Request failed (503). Please try again.',
  ],
])('always supplies a readable fallback for %j', async (body, message) => {
  fetchMock.mockResolvedValue(jsonResponse(body, 503, { 'X-Request-ID': 'proxy-17' }))
  await expect(apiRequest('/games', { auth: false })).rejects.toMatchObject({
    status: 503,
    message,
    requestId: 'proxy-17',
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('keeps the upload-size fallback when validation entries are unusable', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ errors: [{}] }, 413))
  await expect(apiRequest('/upload', { auth: false })).rejects.toMatchObject({
    status: 413,
    message: 'The uploaded file is too large. Please choose a smaller image.',
  })
})

test('registration only maps readable errors onto fields that the form owns', () => {
  expect(
    registrationErrors({
      status: 422,
      errors: [
        null,
        { field: {}, message: 'Invalid' },
        { field: '__proto__', message: 'Invalid' },
        { field: 'email', message: {}, msg: 'Email is taken' },
        { field: 'password', message: '   ' },
      ],
      message: 'Validation failed',
    }),
  ).toEqual({ email: 'Email is taken' })
})

test('registration falls back to detail errors when the problem error list has no valid fields', () => {
  expect(
    registrationErrors({
      status: 422,
      errors: [{}],
      detail: [{ loc: ['body', 'username'], msg: 'Name is taken' }],
    }),
  ).toEqual({ username: 'Name is taken' })
})

test('preserves legacy duplicate-account validation', () => {
  expect(registrationErrors({ status: 400, message: 'Account already exists' })).toEqual({
    username: 'Username or email already exists.',
    email: 'Username or email already exists.',
  })
})
