import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import AccountPage from '../src/pages/AccountPage/AccountPage'
import { normalizeUser } from '../src/api/auth'
import { resetSession } from '../src/api/client'
import { deferred, jsonResponse } from './helpers'

vi.mock('../src/wallet/WalletSection', () => ({ default: () => null }))
vi.mock('../src/currency/CurrencySelector', () => ({ default: () => null }))
vi.mock('../src/pages/AccountPage/FriendsSection', () => ({ default: () => null }))
vi.mock('../src/pages/AccountPage/Library', () => ({ default: () => null }))
vi.mock('../src/hooks/useCatalogResource', () => ({
  default: () => ({ data: [], loading: false, error: null }),
}))
vi.mock('../src/hooks/useOrders', () => ({
  default: () => ({ data: [], ownedIds: [], loading: false, error: null }),
}))
vi.mock('../src/wishlist/context', () => ({ useWishlist: () => ({ count: 0 }) }))

const account = {
  id: 7,
  username: 'player',
  full_name: 'Original name',
  email: 'player@example.com',
  phone: '',
  avatar: '/media/old.webp',
}
const uploaded = { ...account, avatar: '/media/new.webp' }
const avatarFile = () => new File(['image'], 'avatar.webp', { type: 'image/webp' })
let requests
let reply
let revoke

beforeEach(() => {
  resetSession()
  requests = []
  revoke = vi.fn()
  let nextPreview = 0
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => `blob:avatar-${++nextPreview}`)
    static revokeObjectURL = revoke
  })
  reply = (url, options) => jsonResponse(
    url.endsWith('/avatar') ? uploaded : { ...uploaded, ...JSON.parse(options.body) },
  )
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    requests.push({ url, ...options })
    return Promise.resolve(reply(url, options))
  }))
})

function Account({ initial = account }) {
  const [user, setUser] = useState(normalizeUser(initial))
  return <AccountPage user={user} onUpdated={setUser} />
}

function profileAvatar() {
  return within(screen.getByRole('region', { name: 'Account profile' })).getByAltText('')
}

test('keeps a confirmed avatar and edited fields when the profile PATCH fails, then retries only the fields', async () => {
  const user = userEvent.setup()
  let fail = true
  reply = (url, options) => url.endsWith('/avatar')
    ? jsonResponse(uploaded)
    : fail
      ? jsonResponse({ detail: 'Email already in use.' }, 400)
      : jsonResponse({ ...uploaded, ...JSON.parse(options.body) })
  render(<Account />)
  await user.clear(screen.getByLabelText('Full name'))
  await user.type(screen.getByLabelText('Full name'), 'Updated name')
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email already in use.')
  expect(profileAvatar().getAttribute('src')).toContain('/media/new.webp')
  expect(screen.getByRole('status')).toHaveTextContent(/avatar.*saved/i)
  expect(screen.getByLabelText('Full name')).toHaveValue('Updated name')
  expect(screen.getByLabelText('Avatar').files).toHaveLength(0)
  expect(revoke).toHaveBeenCalledWith('blob:avatar-1')
  fail = false
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(requests.map(request => request.url)).toEqual([
    '/api/v1/users/me/avatar', '/api/v1/users/me', '/api/v1/users/me',
  ])
  expect(requests.every(request => request.method === 'PATCH')).toBe(true)
  expect(requests[0].body.get('file').name).toBe('avatar.webp')
  expect(JSON.parse(requests[2].body)).toMatchObject({ full_name: 'Updated name' })
})

test('retains the selected avatar after an upload error and retries before saving details', async () => {
  const user = userEvent.setup()
  let fail = true
  reply = (url, options) => fail
    ? jsonResponse({ detail: 'Upload temporarily unavailable.' }, 503)
    : jsonResponse(url.endsWith('/avatar') ? uploaded : { ...uploaded, ...JSON.parse(options.body) })
  render(<Account />)
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload temporarily unavailable.')
  expect(requests).toHaveLength(1)
  expect(profileAvatar()).toHaveAttribute('src', 'blob:avatar-1')
  expect(screen.getByRole('button', { name: 'Upload avatar now' })).toBeEnabled()
  fail = false
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.')
  expect(requests.map(request => request.url)).toEqual([
    '/api/v1/users/me/avatar', '/api/v1/users/me/avatar', '/api/v1/users/me',
  ])
})

test('direct upload updates the profile without discarding unsaved fields and allows choosing the same file again', async () => {
  const user = userEvent.setup()
  render(<Account />)
  await user.clear(screen.getByLabelText('Full name'))
  await user.type(screen.getByLabelText('Full name'), 'Unsaved name')
  const file = avatarFile()
  await user.upload(screen.getByLabelText('Avatar'), file)
  await user.click(screen.getByRole('button', { name: 'Upload avatar now' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Avatar saved successfully.')
  expect(profileAvatar().getAttribute('src')).toContain('/media/new.webp')
  expect(screen.getByLabelText('Full name')).toHaveValue('Unsaved name')
  expect(requests).toHaveLength(1)
  await user.upload(screen.getByLabelText('Avatar'), file)
  expect(screen.getByRole('button', { name: 'Upload avatar now' })).toBeEnabled()
})

test('locks fields and ignores repeated form submission while saving', async () => {
  const pending = deferred()
  reply = () => pending.promise
  render(<Account />)
  const form = screen.getByRole('button', { name: 'Save profile' }).closest('form')
  act(() => {
    fireEvent.submit(form)
    fireEvent.submit(form)
  })
  expect(requests).toHaveLength(1)
  expect(screen.getByLabelText('Full name')).toBeDisabled()
  expect(screen.getByLabelText('Email')).toBeDisabled()
  expect(screen.getByLabelText('Phone')).toBeDisabled()
  expect(screen.getByLabelText('Avatar')).toBeDisabled()
  await act(async () => pending.resolve(jsonResponse(account)))
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled()
})

test('revokes replaced previews and the remaining preview on unmount', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<Account />)
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  expect(revoke).toHaveBeenCalledWith('blob:avatar-1')
  expect(revoke).not.toHaveBeenCalledWith('blob:avatar-2')
  unmount()
  expect(revoke).toHaveBeenCalledWith('blob:avatar-2')
})

test.each(['upload', 'profile'])('aborts a pending %s when leaving the page and ignores its late response', async (stage) => {
  const user = userEvent.setup()
  const pending = deferred()
  reply = () => pending.promise
  const onUpdated = vi.fn()
  const { unmount } = render(<AccountPage user={normalizeUser(account)} onUpdated={onUpdated} />)
  if (stage === 'upload') await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  unmount()
  expect(requests[0].signal.aborted).toBe(true)
  await act(async () => pending.resolve(jsonResponse(uploaded)))
  expect(onUpdated).not.toHaveBeenCalled()
  expect(requests).toHaveLength(1)
})

test('resets drafts on account change and never continues the old avatar/profile save', async () => {
  const user = userEvent.setup()
  const pending = deferred()
  reply = () => pending.promise
  const onUpdated = vi.fn()
  const { rerender } = render(<AccountPage user={normalizeUser(account)} onUpdated={onUpdated} />)
  await user.clear(screen.getByLabelText('Full name'))
  await user.type(screen.getByLabelText('Full name'), 'Private draft')
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  rerender(<AccountPage user={normalizeUser({ ...account, id: 8, full_name: 'Another user' })} onUpdated={onUpdated} />)
  expect(screen.getByLabelText('Full name')).toHaveValue('Another user')
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  expect(requests[0].signal.aborted).toBe(true)
  await act(async () => pending.resolve(jsonResponse(uploaded)))
  expect(onUpdated).not.toHaveBeenCalled()
  expect(requests).toHaveLength(1)
})

test.each([true, false])('keeps email changes pending and reflects delivery=%s, with resend recovery', async (sent) => {
  const user = userEvent.setup()
  reply = (url) => url.endsWith('/auth/resend-verification')
    ? jsonResponse({ message: 'If an account needs verification, a confirmation email has been sent.' }, 202)
    : jsonResponse({ ...account, email_verified: true, pending_email: 'new@example.com', email_verification_sent: sent })
  render(<Account />)
  await user.clear(screen.getByLabelText('Email', { exact: true }))
  await user.type(screen.getByLabelText('Email', { exact: true }), 'new@example.com')
  await user.click(screen.getByRole('button', { name: 'Save profile' }))
  expect(await screen.findByText('Your email changes only after you confirm the new address.')).toBeInTheDocument()
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('player@example.com')
  expect(screen.getByText('Active email:', { exact: false })).toHaveTextContent('player@example.com')
  expect(screen.getByText('Pending email:', { exact: false })).toHaveTextContent('new@example.com')
  if (sent) expect(screen.getByText('Confirmation email sent. Check your inbox.')).toHaveAttribute('role', 'status')
  else expect(screen.getByRole('alert')).toHaveTextContent('The confirmation email could not be sent.')
  await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  expect(await screen.findByText('If an account needs verification, a confirmation email has been sent.')).toBeInTheDocument()
  expect(JSON.parse(requests.at(-1).body)).toEqual({ email: 'new@example.com' })
})

test('pending verification survives an avatar response that omits private email fields', async () => {
  const user = userEvent.setup()
  render(<Account initial={{ ...account, email_verified: true, pending_email: 'new@example.com' }} />)
  await user.upload(screen.getByLabelText('Avatar'), avatarFile())
  await user.click(screen.getByRole('button', { name: 'Upload avatar now' }))
  await screen.findByText('Avatar saved successfully.')
  expect(screen.getByText('Pending email:', { exact: false })).toHaveTextContent('new@example.com')
  expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeEnabled()
})
