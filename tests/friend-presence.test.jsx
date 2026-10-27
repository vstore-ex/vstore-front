import { StrictMode } from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import FriendsSection from '../src/pages/AccountPage/FriendsSection'
import PresenceHeartbeat from '../src/friends/PresenceHeartbeat'
import { sendPresence } from '../src/api/friends'
import { deferred, jsonResponse } from './helpers'

vi.mock('../src/api/friends', async original => ({ ...(await original()), sendPresence: vi.fn() }))
const friend = { id: 8, username: 'friend', full_name: 'My Friend', is_online: true, status: 'in_game', activity: 'Playing Orbit', last_seen: '2026-10-27T12:00:00Z' }
let visible, reply, calls
beforeEach(() => {
  visible = 'visible'
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible)
  sendPresence.mockReset().mockResolvedValue({})
  calls = []
  reply = path => jsonResponse(path === '/api/v1/friends' ? [friend] : [])
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    calls.push({ url, ...options })
    return Promise.resolve(reply(url))
  }))
})
afterEach(() => { cleanup(); vi.useRealTimers() })
function Session({ id = 7, heartbeat = false }) {
  return <AuthContext.Provider value={{ currentUser: id == null ? null : { id }, isAuthenticated: id != null }}>
    {heartbeat ? <PresenceHeartbeat /> : <FriendsSection />}
  </AuthContext.Provider>
}
const advance = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const event = (name, target = window) => act(() => target.dispatchEvent(new Event(name)))

test('heartbeat starts once under StrictMode, sends once per active minute and stops at logout', async () => {
  vi.useFakeTimers()
  const { rerender } = render(<StrictMode><Session heartbeat /></StrictMode>)
  await advance(0)
  expect(sendPresence).toHaveBeenCalledTimes(1)
  await advance(59999)
  expect(sendPresence).toHaveBeenCalledTimes(1)
  await advance(1)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  rerender(<StrictMode><Session id={null} heartbeat /></StrictMode>)
  await advance(300000)
  expect(sendPresence).toHaveBeenCalledTimes(2)
})

test('heartbeat pauses when hidden, unfocused or in page cache and resumes without focus-event floods', async () => {
  vi.useFakeTimers()
  render(<Session heartbeat />)
  await advance(0)
  for (let i = 0; i < 5; i++) { event('blur'); event('focus'); await advance(1) }
  expect(sendPresence).toHaveBeenCalledTimes(1)
  visible = 'hidden'
  event('visibilitychange', document)
  await advance(180000)
  expect(sendPresence).toHaveBeenCalledTimes(1)
  visible = 'visible'
  event('visibilitychange', document)
  await advance(0)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  event('blur')
  await advance(180000)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  event('focus'); await advance(0)
  expect(sendPresence).toHaveBeenCalledTimes(3)
  event('pagehide'); await advance(180000)
  expect(sendPresence).toHaveBeenCalledTimes(3)
  event('pageshow'); await advance(0)
  expect(sendPresence).toHaveBeenCalledTimes(4)
})

test('heartbeat is absent for guests and does not overlap or continue another user session', async () => {
  vi.useFakeTimers()
  const pending = deferred()
  sendPresence.mockReturnValueOnce(pending.promise)
  const { rerender, unmount } = render(<Session id={null} heartbeat />)
  await advance(60000)
  expect(sendPresence).not.toHaveBeenCalled()
  rerender(<Session heartbeat />)
  await advance(0)
  const oldSignal = sendPresence.mock.calls[0][0]
  await advance(180000)
  expect(sendPresence).toHaveBeenCalledTimes(1)
  rerender(<Session id={9} heartbeat />)
  expect(oldSignal.aborted).toBe(true)
  await advance(0)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  await act(async () => pending.resolve({}))
  await advance(60000)
  expect(sendPresence).toHaveBeenCalledTimes(3)
  unmount()
  await advance(180000)
  expect(sendPresence).toHaveBeenCalledTimes(3)
})

test('heartbeat aborts an in-flight update when the app becomes inactive', async () => {
  vi.useFakeTimers()
  const pending = deferred()
  sendPresence.mockReturnValueOnce(pending.promise)
  render(<Session heartbeat />)
  await advance(0)
  const signal = sendPresence.mock.calls[0][0]
  event('blur')
  expect(signal.aborted).toBe(true)
  await act(async () => pending.reject(new DOMException('Aborted', 'AbortError')))
  await advance(120000)
  expect(sendPresence).toHaveBeenCalledTimes(1)
})

test.each([401, 403])('heartbeat stops after authorization status %s', async status => {
  vi.useFakeTimers()
  sendPresence.mockRejectedValueOnce({ status })
  render(<Session heartbeat />)
  await advance(0)
  event('blur'); event('focus')
  await advance(600000)
  expect(sendPresence).toHaveBeenCalledTimes(1)
})

test('heartbeat backs off network failures and returns to the normal interval after success', async () => {
  vi.useFakeTimers()
  sendPresence.mockRejectedValueOnce(new TypeError('Offline')).mockRejectedValueOnce(new Error('Unavailable'))
  render(<Session heartbeat />)
  await advance(0)
  await advance(119999)
  expect(sendPresence).toHaveBeenCalledTimes(1)
  await advance(1)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  await advance(239999)
  expect(sendPresence).toHaveBeenCalledTimes(2)
  await advance(1)
  expect(sendPresence).toHaveBeenCalledTimes(3)
  await advance(60000)
  expect(sendPresence).toHaveBeenCalledTimes(4)
})

test('friend cards show textual status, activity and last seen, but request senders do not expose presence', async () => {
  reply = path => jsonResponse(path === '/api/v1/friends' ? [friend, { ...friend, id: 9, username: 'offline', is_online: false, activity: null }, { id: 10, username: 'unknown', status: {}, activity: {}, last_seen: 'invalid' }]
    : path.endsWith('/incoming') ? [{ id: 1, sender: { ...friend, username: 'stranger' } }] : [])
  const user = userEvent.setup()
  render(<Session />)
  const card = (await screen.findByText('@friend')).closest('article')
  expect(within(card).getByText('Online · In game')).toBeInTheDocument()
  expect(within(card).getByText('Playing Orbit')).toBeInTheDocument()
  expect(card.querySelector('time')).toHaveAttribute('dateTime', friend.last_seen)
  expect(screen.getByText('Offline')).toBeInTheDocument()
  expect(screen.getByText('Status unavailable')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Incoming requests/ }))
  expect(screen.getByText('@stranger')).toBeInTheDocument()
  expect(screen.queryByText('Playing Orbit')).not.toBeInTheDocument()
  expect(calls.some(call => /\/\d+\/presence/.test(call.url))).toBe(false)
})

test('refresh keeps last known friends during a network failure and recovers when reopening the tab', async () => {
  const user = userEvent.setup()
  render(<Session />)
  await screen.findByText('Playing Orbit')
  const pending = deferred()
  reply = path => path === '/api/v1/friends' ? pending.promise : jsonResponse([])
  await user.click(screen.getByRole('button', { name: 'Refresh friends' }))
  expect(screen.getByText('Last known status: Online · In game')).toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse({ detail: 'Presence unavailable' }, 503)))
  expect(await screen.findByRole('alert')).toHaveTextContent('Presence unavailable')
  expect(screen.getByText('Playing Orbit')).toBeInTheDocument()
  reply = path => jsonResponse(path === '/api/v1/friends' ? [{ ...friend, is_online: false, status: 'offline', activity: null }] : [])
  await user.click(screen.getByRole('tab', { name: /Outgoing requests/ }))
  await user.click(screen.getByRole('tab', { name: /My friends/ }))
  expect(await screen.findByText('Offline')).toBeInTheDocument()
  expect(screen.queryByText('Playing Orbit')).not.toBeInTheDocument()
})

test('403 on refresh clears private friend cards and offers retry', async () => {
  const user = userEvent.setup()
  render(<Session />)
  await screen.findByText('Playing Orbit')
  reply = () => jsonResponse({ detail: 'presence is only available for accepted friends' }, 403)
  await user.click(screen.getByRole('button', { name: 'Refresh friends' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Friends and presence are unavailable')
  expect(screen.queryByText('@friend')).not.toBeInTheDocument()
  expect(screen.queryByText('Playing Orbit')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry my friends' })).toBeEnabled()
})

test('friend presence disappears on logout and late responses cannot repopulate another account', async () => {
  const pending = deferred()
  reply = () => pending.promise
  const { rerender } = render(<Session />)
  const signals = calls.map(call => call.signal)
  rerender(<Session id={null} />)
  expect(signals.every(signal => signal.aborted)).toBe(true)
  reply = () => jsonResponse([])
  rerender(<Session id={9} />)
  await screen.findByText('No friends yet. Send an invitation using their user ID.')
  await act(async () => pending.resolve(jsonResponse([friend])))
  expect(screen.queryByText('@friend')).not.toBeInTheDocument()
})
