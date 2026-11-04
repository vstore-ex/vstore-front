import { StrictMode, useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import NotificationsProvider from '../src/notifications/NotificationsProvider'
import NotificationCenter from '../src/notifications/NotificationCenter'
import NotificationsPage from '../src/pages/NotificationsPage/NotificationsPage'
import { apiRequest } from '../src/api/client'
import { deferred } from './helpers'

vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
const notice = (id, extra = {}) => ({ id: String(id), user_id: 7, title: 'Update ' + id, message: 'Your activity update.', is_read: false, created_at: '2026-10-29T10:00:00Z', data: {}, ...extra })
let records, failure, mutationFailure, pendingMutation
const listRequests = () => apiRequest.mock.calls.filter(([path]) => path.startsWith('/notifications?'))
const readRequests = () => apiRequest.mock.calls.filter(([path]) => path === '/notifications/read')

beforeEach(() => {
  vi.stubGlobal('WebSocket', undefined)
  records = [notice(1), notice(2, { is_read: true }), notice(3)]
  failure = null
  mutationFailure = null
  pendingMutation = null
  apiRequest.mockReset()
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/notifications/unread-count') return { unread_count: records.filter((item) => !item.is_read).length }
    if (path.startsWith('/notifications?')) {
      if (failure) throw failure
      const query = new URLSearchParams(path.split('?')[1])
      const filtered = query.get('unread_only') === 'true' ? records.filter((item) => !item.is_read) : records
      const offset = Number(query.get('offset')), limit = Number(query.get('limit'))
      return { items: filtered.slice(offset, offset + limit), total: records.length, unread_count: records.filter((item) => !item.is_read).length }
    }
    if (path === '/notifications/read') {
      if (pendingMutation) await pendingMutation.promise
      if (mutationFailure) throw mutationFailure
      const ids = options.body.notification_ids
      let marked = 0
      records = records.map((item) => {
        if (!item.is_read && (ids === null || ids.includes(item.id))) { marked++; return { ...item, is_read: true } }
        return item
      })
      return { marked_count: marked }
    }
    if (options.method === 'DELETE' && path.startsWith('/notifications/')) {
      if (mutationFailure) throw mutationFailure
      records = records.filter((item) => item.id !== path.split('/').at(-1))
      return null
    }
    throw new Error('Unexpected request: ' + path)
  })
})

function SessionControls({ initialPage }) {
  const [open, setOpen] = useState(initialPage)
  return <><NotificationCenter /><button onClick={() => setOpen((value) => !value)}>Toggle notification page</button>{open && <NotificationsPage />}</>
}
function Harness({ initialUser = 7, initialPage = true }) {
  const [id, setId] = useState(initialUser)
  return <AuthContext.Provider value={{ currentUser: id ? { id } : null, isAuthenticated: !!id }}>
    <button onClick={() => setId(null)}>Logout</button><button onClick={() => setId(8)}>Switch account</button>
    <NotificationsProvider>{id ? <SessionControls initialPage={initialPage} /> : <NotificationsPage />}</NotificationsProvider>
  </AuthContext.Provider>
}
const setup = (props = {}) => { const user = userEvent.setup(); const result = render(<StrictMode><Harness {...props} /></StrictMode>); return { user, ...result } }
const card = (id) => screen.getByRole('heading', { name: 'Update ' + id, exact: true }).closest('li')
const badge = (count) => screen.getByRole('button', { name: `Notifications, ${count} unread` })

test('loads badge on sign-in, fetches on opening the page and renders the list in StrictMode', async () => {
  const { user } = setup({ initialPage: false })
  expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument()
  expect(listRequests()).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Toggle notification page' }))
  await screen.findByRole('heading', { name: 'Update 1' })
  expect(screen.queryByRole('heading', { name: 'Update 2' })).not.toBeInTheDocument()
  expect(within(card(1)).getByText('Unread', { exact: true })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Unread only' })).toBeChecked()
  expect(within(card(1)).getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Mark selected as read' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('loading/empty/retry states do not invent a zero unread count on failure', async () => {
  const pending = deferred()
  apiRequest.mockImplementation(() => pending.promise)
  const { user } = setup()
  expect(screen.getByRole('status')).toHaveTextContent('Loading notifications')
  expect(screen.getByRole('button', { name: /loading unread count/ })).toBeInTheDocument()
  await act(async () => pending.reject(new Error('Temporarily unavailable')))
  expect(screen.getByRole('alert')).toHaveTextContent('Temporarily unavailable')
  expect(screen.getByRole('button', { name: /unread count unavailable/ })).toBeInTheDocument()
  apiRequest.mockResolvedValue({ items: [], total: 0, unread_count: 0 })
  await user.click(screen.getByRole('button', { name: 'Retry notifications' }))
  expect(await screen.findByText('No unread notifications.')).toBeInTheDocument()
  expect(badge(0)).toBeInTheDocument()
})

test('selected and all read actions refresh both list and count with explicit payloads', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  await user.click(screen.getByRole('checkbox', { name: 'Select Update 1' }))
  pendingMutation = deferred()
  await user.click(screen.getByRole('button', { name: 'Mark selected as read' }))
  expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete Update 1' })).toBeDisabled()
  expect(readRequests()).toHaveLength(1)
  expect(readRequests()[0][1].body).toEqual({ notification_ids: ['1'] })
  await act(async () => pendingMutation.resolve())
  await waitFor(() => expect(badge(1)).toBeInTheDocument())
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Update 3' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  await waitFor(() => expect(badge(0)).toBeInTheDocument())
  expect(readRequests()[1][1].body).toEqual({ notification_ids: null })
  expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
})

test('deletes an item and refreshes count and list', async () => {
  const { user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Delete Update 1' }))
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument())
  expect(badge(1)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Notification deleted.')
})

test('unread pagination uses unread_count rather than total and returns to page 1 after filtering', async () => {
  records = Array.from({ length: 42 }, (_, index) => notice(index + 1, { is_read: index >= 21 }))
  const { user } = setup()
  await user.click(await screen.findByRole('checkbox', { name: 'Unread only' }))
  await screen.findByText('Page 1 of 3')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Page 2 of 3')
  await user.click(screen.getByRole('checkbox', { name: 'Unread only' }))
  await screen.findByText('Page 1 of 2')
  expect(listRequests().at(-1)[0]).toContain('offset=0&unread_only=true')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Page 2 of 2')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  expect(await screen.findByText('No unread notifications.')).toBeInTheDocument()
  expect(listRequests().at(-1)[0]).toContain('offset=0&unread_only=true')
  expect(badge(0)).toBeInTheDocument()
})

test('unread filter responds immediately while loading and restores the prior filter on failure', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  const filter = screen.getByRole('checkbox', { name: 'Unread only' })
  expect(filter).toBeChecked()
  await user.click(filter)
  await screen.findByRole('heading', { name: 'Update 2' })
  const pending = deferred()
  apiRequest.mockImplementation(() => pending.promise)
  await user.click(filter)
  expect(filter).toBeChecked()
  expect(filter).toBeDisabled()
  expect(card(2)).toBeInTheDocument()
  await act(async () => pending.reject(new Error('Filter unavailable')))
  expect(filter).not.toBeChecked()
  expect(card(2)).toBeInTheDocument()
  apiRequest.mockResolvedValue({ items: [notice(1)], total: 3, unread_count: 1 })
  await user.click(screen.getByRole('button', { name: 'Retry notifications' }))
  await waitFor(() => expect(filter).toBeChecked())
  expect(screen.queryByRole('heading', { name: 'Update 2' })).not.toBeInTheDocument()
})

test('deleting the last item on the final page clamps to the remaining page', async () => {
  records = Array.from({ length: 21 }, (_, index) => notice(index + 1))
  const { user } = setup()
  await screen.findByText('Page 1 of 2')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(await screen.findByRole('button', { name: 'Delete Update 21' }))
  await screen.findByText('Page 1 of 1')
  expect(screen.getAllByRole('listitem')).toHaveLength(20)
  expect(badge(20)).toBeInTheDocument()
})

test('pagination keeps cards and page labels during a failed request, and retries the requested page', async () => {
  records = Array.from({ length: 21 }, (_, index) => notice(index + 1))
  const { user } = setup()
  await screen.findByText('Page 1 of 2')
  const server = apiRequest.getMockImplementation(), pending = deferred()
  apiRequest.mockImplementation((path, options) => path.includes('offset=20') ? pending.promise : server(path, options))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(card(1)).toBeInTheDocument()
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  await act(async () => pending.reject(new Error('Network error')))
  expect(screen.getByRole('alert')).toHaveTextContent('Showing previously loaded notifications.')
  expect(card(1)).toBeInTheDocument()
  apiRequest.mockImplementation(server)
  await user.click(screen.getByRole('button', { name: 'Retry notifications' }))
  await screen.findByText('Page 2 of 2')
  expect(card(21)).toBeInTheDocument()
})

test.each(['read', 'delete'])('failed %s preserves the view and allows retry', async (action) => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  await user.click(screen.getByRole('checkbox', { name: 'Select Update 1' }))
  mutationFailure = new Error('Service unavailable')
  const button = action === 'read' ? 'Mark selected as read' : 'Delete Update 1'
  await user.click(screen.getByRole('button', { name: button }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  expect(screen.getByRole('checkbox', { name: 'Select Update 1' })).toBeChecked()
  expect(card(1)).toBeInTheDocument()
  mutationFailure = null
  await user.click(screen.getByRole('button', { name: button }))
  await waitFor(() => expect(badge(1)).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('confirmed write with failed reconciliation asks for refresh without pretending the view is current', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  failure = new Error('Refresh failed')
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  expect(await screen.findByText('Update completed. Refresh to see the latest notifications.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /unread count unavailable/ })).toBeInTheDocument()
  expect(card(1)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  failure = null
  await user.click(screen.getByRole('button', { name: 'Retry notifications' }))
  await waitFor(() => expect(badge(0)).toBeInTheDocument())
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
  expect(screen.getByText('No unread notifications.')).toBeInTheDocument()
  expect(readRequests()).toHaveLength(1)
})

test('private authorization failures clear existing data and allow refreshing access', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  failure = Object.assign(new Error('Forbidden'), { status: 403 })
  await user.click(screen.getByRole('button', { name: 'Refresh notifications' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
  failure = null
  await user.click(screen.getByRole('button', { name: 'Retry notifications' }))
  expect(await screen.findByRole('heading', { name: 'Update 1' })).toBeInTheDocument()
})

test('late initial unread count cannot replace the fresher list count', async () => {
  const pending = deferred(), server = apiRequest.getMockImplementation()
  apiRequest.mockImplementation((path, options) => path.endsWith('/unread-count') ? pending.promise : server(path, options))
  const { user } = setup({ initialPage: false })
  const countSignals = apiRequest.mock.calls.map(([, options]) => options.signal)
  await user.click(screen.getByRole('button', { name: 'Toggle notification page' }))
  await screen.findByRole('heading', { name: 'Update 1' })
  await act(async () => pending.resolve({ unread_count: 99 }))
  expect(badge(2)).toBeInTheDocument()
  expect(countSignals.every((signal) => signal.aborted)).toBe(true)
})

test('guests make no private requests', () => {
  setup({ initialUser: null })
  expect(screen.getByText('Please sign in to view your notifications.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalled()
})

test('failed initial count offers recovery by opening the notification panel', async () => {
  const server = apiRequest.getMockImplementation()
  apiRequest.mockImplementation((path, options) => path.endsWith('/unread-count') ? Promise.reject(new Error('Count unavailable')) : server(path, options))
  const { user } = setup({ initialPage: false })
  await user.click(await screen.findByRole('button', { name: 'Notifications, unread count unavailable' }))
  expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('Update 1')
})

test('logging out aborts the initial unread count and ignores its late completion', async () => {
  const pending = deferred()
  apiRequest.mockImplementation(() => pending.promise)
  const { user } = setup({ initialPage: false })
  const signals = apiRequest.mock.calls.map(([, options]) => options.signal)
  await user.click(screen.getByRole('button', { name: 'Logout' }))
  await act(async () => pending.resolve({ unread_count: 42 }))
  expect(signals.every((signal) => signal.aborted)).toBe(true)
  expect(screen.queryByRole('button', { name: /Notifications,/ })).not.toBeInTheDocument()
})

test('switching users aborts the old list and ignores its late response', async () => {
  const pending = deferred()
  apiRequest.mockImplementation(() => pending.promise)
  const { user } = setup()
  const signals = listRequests().map(([, options]) => options.signal)
  apiRequest.mockResolvedValue({ items: [notice(8, { user_id: 8, title: 'New account update' })], total: 1, unread_count: 1 })
  await user.click(screen.getByRole('button', { name: 'Switch account' }))
  await screen.findByRole('heading', { name: 'New account update' })
  await act(async () => pending.resolve({ items: [notice(1)], total: 1, unread_count: 1 }))
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
  expect(signals.every((signal) => signal.aborted)).toBe(true)
})

test('logout aborts an in-flight mutation and prevents its later refresh', async () => {
  const { user } = setup()
  await screen.findByRole('heading', { name: 'Update 1' })
  pendingMutation = deferred()
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  const signal = readRequests()[0][1].signal
  const before = listRequests().length
  await user.click(screen.getByRole('button', { name: 'Logout' }))
  expect(signal.aborted).toBe(true)
  await act(async () => pendingMutation.resolve())
  expect(listRequests()).toHaveLength(before)
  expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
})

test('rejects a list belonging to a different user', async () => {
  records = [notice(1, { user_id: 8 })]
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify notification ownership')
  expect(screen.queryByRole('heading', { name: 'Update 1' })).not.toBeInTheDocument()
})

test('renders untrusted text literally and only constructs known local links', async () => {
  records = [notice(1, { title: '<img onerror=alert(1)>', message: '[Click](javascript:alert(1))', data: { url: 'https://evil.test' } }), notice(2, { type: 'friend_request', data: { sender_id: 8 } })]
  setup()
  expect(await screen.findByRole('heading', { name: '<img onerror=alert(1)>' })).toBeInTheDocument()
  expect(screen.getByText('[Click](javascript:alert(1))')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '#/users/8')
  expect(document.querySelector('a[href^="https://evil"]')).toBeNull()
})

test('message notification cards link directly to their conversation', async () => {
  records = [
    notice(12, {
      title: 'New message',
      message: 'New message from alex',
      type: 'new_message',
      data: { conversation_id: 12, sender_id: 8 },
    }),
  ]
  setup()
  const link = await screen.findByRole('link', { name: /Open conversation/ })
  expect(link).toHaveAttribute('href', '#/messages/12')
  expect(within(link).getByRole('heading', { name: 'New message' })).toBeInTheDocument()
})
