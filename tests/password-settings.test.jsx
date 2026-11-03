import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import PasswordSettings from '../src/pages/AccountPage/PasswordSettings'
import { changePassword } from '../src/api/auth'

vi.mock('../src/api/auth', async (original) => ({
  ...(await original()),
  changePassword: vi.fn(),
}))

beforeEach(() => {
  changePassword.mockReset()
})

test('checks password policy and confirmation before calling the API', async () => {
  const user = userEvent.setup()
  render(<PasswordSettings />)

  await user.type(screen.getByLabelText('Current password'), 'old-password')
  await user.type(screen.getByLabelText('New password'), 'short')
  await user.type(screen.getByLabelText('Confirm new password'), 'different')
  await user.click(screen.getByRole('button', { name: 'Change password' }))

  expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
    'Password must be at least 12 characters. At least 12 characters and no more than 72 UTF-8 bytes.',
  )
  expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(
    'Passwords do not match.',
  )
  expect(changePassword).not.toHaveBeenCalled()
})

test('changes password and invokes the logout callback after backend success', async () => {
  const user = userEvent.setup()
  const onPasswordChanged = vi.fn()
  changePassword.mockResolvedValue({ message: 'Password changed. Sign in again on your devices.' })
  render(<PasswordSettings onPasswordChanged={onPasswordChanged} />)

  await user.type(screen.getByLabelText('Current password'), 'old-password')
  await user.type(screen.getByLabelText('New password'), 'new-password-long')
  await user.type(screen.getByLabelText('Confirm new password'), 'new-password-long')
  await user.click(screen.getByRole('button', { name: 'Change password' }))

  expect(changePassword).toHaveBeenCalledWith({
    current_password: 'old-password',
    new_password: 'new-password-long',
  })
  expect(onPasswordChanged).toHaveBeenCalledOnce()
})

test('maps a wrong current password to its field', async () => {
  const user = userEvent.setup()
  changePassword.mockRejectedValue({ status: 400, message: 'current password is incorrect' })
  render(<PasswordSettings />)

  await user.type(screen.getByLabelText('Current password'), 'wrong-password')
  await user.type(screen.getByLabelText('New password'), 'new-password-long')
  await user.type(screen.getByLabelText('Confirm new password'), 'new-password-long')
  await user.click(screen.getByRole('button', { name: 'Change password' }))

  expect(await screen.findByLabelText('Current password')).toHaveAccessibleDescription(
    'current password is incorrect',
  )
})
