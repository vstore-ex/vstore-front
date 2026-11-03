import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import RegisterPage from '../src/pages/RegisterPage/RegisterPage'
import { registerUser, getGoogleAuthorizationUrl, resendVerification } from '../src/api/auth'
import { deferred } from './helpers'

vi.mock('../src/api/auth', async (original) => ({
  ...(await original()),
  registerUser: vi.fn(),
  getGoogleAuthorizationUrl: vi.fn(),
  resendVerification: vi.fn(),
}))
let login, close, authenticated, forgotPassword
beforeEach(() => {
  login = vi.fn(async () => ({ data: { id: 7 }, message: 'Signed in successfully.' }))
  close = vi.fn()
  authenticated = vi.fn()
  forgotPassword = vi.fn()
  registerUser.mockReset().mockResolvedValue({
    data: { email: 'reader@example.com', email_sent: true },
    message: 'Confirm your email before signing in.',
  })
  resendVerification
    .mockReset()
    .mockResolvedValue('If an account needs verification, a confirmation email has been sent.')
  getGoogleAuthorizationUrl.mockReset()
})

function Auth({ mode = 'login' }) {
  const [open, setOpen] = useState(false)
  return (
    <AuthContext.Provider value={{ login }}>
      <button onClick={() => setOpen(true)}>Open sign in</button>
      {open && (
        <RegisterPage
          initialMode={mode}
          onAuthenticated={authenticated}
          onForgotPassword={forgotPassword}
          onClose={() => {
            close()
            setOpen(false)
          }}
        />
      )}
    </AuthContext.Provider>
  )
}
async function open(mode) {
  const user = userEvent.setup()
  render(<Auth mode={mode} />)
  await user.click(screen.getByRole('button', { name: 'Open sign in' }))
  return user
}
async function fillRegistration(user) {
  await user.type(screen.getByLabelText('PUT YOUR EMAIL HERE'), 'reader@example.com')
  await user.type(screen.getByLabelText('CREATE AN ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('CREATE A PASSWORD'), 'longsecret1234')
  await user.click(screen.getByRole('checkbox', { name: /I am human/ }))
}

test('opens a labelled native modal, focuses its first field and restores the opener on cancel', async () => {
  await open()
  const dialog = screen.getByRole('dialog', { name: 'Log in' })
  expect(dialog.tagName).toBe('DIALOG')
  expect(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME')).toHaveFocus()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(close).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open sign in' })).toHaveFocus()
})

test('offers a password reset request from the login dialog', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Forgot your password?' }))
  expect(forgotPassword).toHaveBeenCalledOnce()
})

test('links login validation messages and focuses the first invalid field without moving focus during edits', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  const name = screen.getByLabelText('SIGN IN WITH ACCOUNT NAME')
  const password = screen.getByLabelText('PASSWORD', { exact: true })
  expect(name).toHaveFocus()
  expect(name).toHaveAccessibleDescription('Username must be at least 3 characters.')
  expect(password).toHaveAccessibleDescription('Password is required.')
  expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.')
  await user.type(name, 'reader')
  expect(name).toHaveFocus()
  expect(name).not.toHaveAttribute('aria-describedby')
  expect(name).toHaveAttribute('aria-invalid', 'false')
  expect(login).not.toHaveBeenCalled()
})

test('registration associates checkbox errors and follows the visual field order', async () => {
  const user = await open('register')
  const terms = screen.getByRole('checkbox', { name: /I am 13/ })
  await user.click(terms)
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(screen.getByLabelText('PUT YOUR EMAIL HERE')).toHaveFocus()
  expect(terms).toHaveAttribute('aria-invalid', 'true')
  expect(terms).toHaveAccessibleDescription('You must accept the terms.')
  const human = screen.getByRole('checkbox', { name: /I am human/ })
  expect(human).toHaveAttribute('aria-invalid', 'true')
  expect(human).toHaveAccessibleDescription('Please confirm that you are human.')
  expect(registerUser).not.toHaveBeenCalled()
})

test('registration enforces the server password length policy before submitting', async () => {
  const user = await open('register')
  await user.type(screen.getByLabelText('PUT YOUR EMAIL HERE'), 'reader@example.com')
  await user.type(screen.getByLabelText('CREATE AN ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('CREATE A PASSWORD'), 'short123')
  await user.click(screen.getByRole('checkbox', { name: /I am human/ }))

  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))

  const password = screen.getByLabelText('CREATE A PASSWORD')
  expect(password).toHaveFocus()
  expect(password).toHaveAccessibleDescription(
    'Password must be at least 12 characters. Use at least 12 characters. Passwords are limited to 72 UTF-8 bytes.',
  )
  expect(registerUser).not.toHaveBeenCalled()
})

test('focuses server field validation, then announces account creation and refocuses login', async () => {
  const user = await open('register')
  await fillRegistration(user)
  registerUser.mockRejectedValueOnce({
    status: 422,
    errors: [{ field: 'email', message: 'Email is taken' }],
    message: 'Email is taken',
  })
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  const email = screen.getByLabelText('PUT YOUR EMAIL HERE')
  await waitFor(() => expect(email).toHaveFocus())
  expect(email).toHaveAccessibleDescription('Email is taken')
  await user.clear(email)
  await user.type(email, 'other@example.com')
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  const created = await screen.findByRole('heading', { name: 'Confirm your email' })
  expect(created).toHaveFocus()
  expect(screen.getByRole('dialog', { name: 'Confirm your email' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Back to log in', exact: true }))
  expect(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME')).toHaveFocus()
})

test('prevents Escape and duplicate submits during login and permits closing after failure', async () => {
  const user = await open()
  await user.type(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('PASSWORD', { exact: true }), 'secret123')
  const pending = deferred()
  login.mockReturnValueOnce(pending.promise)
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  const dialog = screen.getByRole('dialog', { name: 'Log in' })
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled()
  expect(screen.getByLabelText('PASSWORD', { exact: true })).toBeDisabled()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(close).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'PLEASE WAIT...' }))
  expect(login).toHaveBeenCalledTimes(1)
  await act(async () => pending.reject(new Error('Invalid credentials')))
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(close).toHaveBeenCalledTimes(1)
})

test('successful login preserves the authentication callback and closes once', async () => {
  const user = await open()
  await user.type(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('PASSWORD', { exact: true }), 'secret123')
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(login).toHaveBeenCalledExactlyOnceWith({ username: 'reader', password: 'secret123' })
  expect(authenticated).toHaveBeenCalledExactlyOnceWith({ id: 7 })
  expect(close).toHaveBeenCalledTimes(1)
})

test('keeps the dialog usable after Google authorization fails', async () => {
  getGoogleAuthorizationUrl.mockRejectedValueOnce(new Error('Google sign-in is unavailable.'))
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in is unavailable.')
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Go back' }))
  expect(close).toHaveBeenCalledTimes(1)
})

test('registration requires confirmation and identifies the destination without signing in', async () => {
  const user = await open('register')
  await fillRegistration(user)
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(await screen.findByRole('heading', { name: 'Confirm your email' })).toHaveFocus()
  expect(screen.getByText('reader@example.com')).toBeInTheDocument()
  expect(screen.getByText(/before signing in/)).toBeInTheDocument()
  expect(screen.queryByText(/Your account is ready|You can sign in now/)).not.toBeInTheDocument()
  expect(login).not.toHaveBeenCalled()
  expect(authenticated).not.toHaveBeenCalled()
})

test('failed signup delivery offers a recoverable resend with the generic backend response', async () => {
  registerUser.mockResolvedValueOnce({ data: { email: 'reader@example.com', email_sent: false } })
  const user = await open('register')
  await fillRegistration(user)
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be sent')
  resendVerification.mockRejectedValueOnce(new Error('Email service unavailable.'))
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email service unavailable.')
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'If an account needs verification, a confirmation email has been sent.',
  )
  expect(resendVerification.mock.calls[1][0]).toBe('reader@example.com')
  expect(registerUser).toHaveBeenCalledTimes(1)
})

test('unverified login opens email guidance and resend, keeping the account name for a later login', async () => {
  login.mockRejectedValueOnce({
    status: 403,
    message:
      'Email not confirmed. Open the link we sent or request a new one at /api/v1/auth/resend-verification.',
  })
  const user = await open()
  await user.type(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('PASSWORD', { exact: true }), 'secret123')
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(await screen.findByRole('heading', { name: 'Confirm your email' })).toHaveFocus()
  expect(screen.getByLabelText('Email address for confirmation')).toHaveValue('')
  await user.type(screen.getByLabelText('Email address for confirmation'), 'reader@example.com')
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(await screen.findByRole('status')).toHaveTextContent('If an account needs verification')
  expect(authenticated).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Back to log in' }))
  expect(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME')).toHaveValue('reader')
})

test('resend validates email, blocks duplicate requests and aborts when leaving the confirmation view', async () => {
  const user = await open()
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  const address = screen.getByLabelText('Email address for confirmation')
  expect(address).toHaveFocus()
  expect(address).toHaveAccessibleDescription('Enter a valid email address.')
  expect(resendVerification).not.toHaveBeenCalled()
  await user.type(address, 'reader@example.com')
  const pending = deferred()
  resendVerification.mockReturnValueOnce(pending.promise)
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(screen.getByRole('button', { name: 'Requesting email...' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('form', { name: 'Email confirmation' }))
  expect(resendVerification).toHaveBeenCalledTimes(1)
  const signal = resendVerification.mock.calls[0][1]
  await user.click(screen.getByRole('button', { name: 'Back to log in' }))
  expect(signal.aborted).toBe(true)
  await act(async () => pending.resolve('Late response'))
  expect(screen.queryByText('Late response')).not.toBeInTheDocument()
})

test('resend rate limiting leaves a retry path and unrelated 403 errors stay on login', async () => {
  login.mockRejectedValueOnce({ status: 403, message: 'Sign-in is unavailable.' })
  const user = await open()
  await user.type(screen.getByLabelText('SIGN IN WITH ACCOUNT NAME'), 'reader')
  await user.type(screen.getByLabelText('PASSWORD', { exact: true }), 'secret123')
  await user.click(screen.getByRole('button', { name: 'SIGN IN', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in is unavailable.')
  expect(screen.getByRole('dialog', { name: 'Log in' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  await user.type(screen.getByLabelText('Email address for confirmation'), 'reader@example.com')
  resendVerification.mockRejectedValueOnce({ status: 429 })
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Too many requests. Please try again later.',
  )
  expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeEnabled()
})
