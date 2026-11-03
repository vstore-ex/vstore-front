import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import PasswordResetRequestPage from '../src/pages/PasswordResetRequestPage/PasswordResetRequestPage'
import { requestPasswordReset } from '../src/api/auth'

vi.mock('../src/api/auth', async (original) => ({
  ...(await original()),
  requestPasswordReset: vi.fn(),
}))

beforeEach(() => {
  requestPasswordReset.mockReset()
})

test('validates email and does not send a request for invalid input', async () => {
  const user = userEvent.setup()
  render(<PasswordResetRequestPage />)

  await user.type(screen.getByLabelText('Email address'), 'not-an-email')
  await user.click(screen.getByRole('button', { name: 'Send reset link' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.')
  expect(requestPasswordReset).not.toHaveBeenCalled()
})

test('shows the same non-enumerating confirmation after a successful request', async () => {
  const user = userEvent.setup()
  requestPasswordReset.mockResolvedValue(
    'If an account exists for this address, reset instructions have been sent.',
  )
  render(<PasswordResetRequestPage />)

  await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
  await user.click(screen.getByRole('button', { name: 'Send reset link' }))

  expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
  expect(requestPasswordReset).toHaveBeenCalledWith('reader@example.com', expect.any(AbortSignal))
})

test.each([
  [{ status: 429, retryAfter: 37 }, 'try again in 37 seconds'],
  [{ status: 503, message: 'Service unavailable' }, 'Password reset is temporarily unavailable'],
])('presents a retryable reset-request error', async (error, expectedMessage) => {
  const user = userEvent.setup()
  requestPasswordReset.mockRejectedValue(error)
  render(<PasswordResetRequestPage />)

  await user.type(screen.getByLabelText('Email address'), 'reader@example.com')
  await user.click(screen.getByRole('button', { name: 'Send reset link' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(expectedMessage)
  expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled()
})
