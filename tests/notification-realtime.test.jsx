import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import NotificationCenter from '../src/notifications/NotificationCenter'
import NotificationsProvider from '../src/notifications/NotificationsProvider'
import { NotificationsContext, useNotifications } from '../src/notifications/context'
import * as notificationsApi from '../src/api/notifications'

vi.mock('../src/api/notifications', async (original) => ({
  ...(await original()),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationsRead: vi.fn(),
}))

const emptyNotifications = { items: [], total: 0, unread_count: 0 }

let sockets

class FakeWebSocket {
  constructor(url) {
    this.url = url
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    sockets.push(this)
  }

  close() {
    this.onclose?.({ code: 1000 })
  }
}

function Probe() {
  const { notifications, unreadCount, markAsRead, refresh } = useNotifications()
  useEffect(() => { refresh() }, [refresh])
  return (
    <>
      <span aria-label="Unread count">{unreadCount}</span>
      <span aria-label="Notification count">{notifications.length}</span>
      <button type="button" onClick={() => void markAsRead(['notice-1'])}>
        Mark first read
      </button>
    </>
  )
}

function AuthenticatedProvider() {
  return (
    <AuthContext.Provider value={{ currentUser: { id: 7 }, isAuthenticated: true }}>
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>
    </AuthContext.Provider>
  )
}

beforeEach(() => {
  sockets = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  notificationsApi.getNotifications.mockReset().mockResolvedValue(emptyNotifications)
  notificationsApi.getUnreadCount.mockReset().mockResolvedValue(0)
  notificationsApi.markNotificationsRead.mockReset().mockResolvedValue({ marked_count: 1 })
})

test('loads notifications and shows new message events from the authenticated socket', async () => {
  const incoming = {
    id: 'notice-1',
    user_id: 7,
    type: 'new_message',
    title: 'New message',
    message: 'New message from alex',
    data: { message_id: 41, conversation_id: 12 },
    is_read: false,
    created_at: '2026-10-27T10:00:00Z',
  }
  notificationsApi.getNotifications.mockResolvedValueOnce(emptyNotifications).mockResolvedValue({
    items: [incoming],
    total: 1,
    unread_count: 1,
  })

  render(<AuthenticatedProvider />)
  await waitFor(() => expect(sockets).toHaveLength(1))
  await waitFor(() => expect(notificationsApi.getNotifications).toHaveBeenCalled())
  expect(sockets[0].url).toBe('ws://localhost/api/v1/messages/ws')

  await act(async () => {
    await sockets[0].onmessage({
      data: JSON.stringify({ type: 'new_message', data: { message_id: 41 } }),
    })
  })

  expect(screen.getByText('New message from alex')).toBeInTheDocument()
  expect(screen.getByLabelText('Unread count')).toHaveTextContent('1')
  expect(screen.getByLabelText('Notification count')).toHaveTextContent('1')
  const requests = notificationsApi.getNotifications.mock.calls.length
  await act(async () => {
    await sockets[0].onmessage({ data: JSON.stringify({ type: 'new_message', data: { message_id: 41 } }) })
  })
  expect(notificationsApi.getNotifications.mock.calls).toHaveLength(requests)
})

test('marks selected notifications as read and refreshes the unread count', async () => {
  const user = userEvent.setup()
  notificationsApi.getNotifications
    .mockResolvedValueOnce({
      items: [{ id: 'notice-1', user_id: 7, is_read: false }],
      total: 1,
      unread_count: 1,
    })
    .mockResolvedValueOnce({
      items: [{ id: 'notice-1', user_id: 7, is_read: true }],
      total: 1,
      unread_count: 0,
    })

  render(<AuthenticatedProvider />)
  await waitFor(() => expect(screen.getByLabelText('Unread count')).toHaveTextContent('1'))
  await user.click(screen.getByRole('button', { name: 'Mark first read' }))

  await waitFor(() => expect(screen.getByLabelText('Unread count')).toHaveTextContent('0'))
  expect(notificationsApi.markNotificationsRead).toHaveBeenCalledWith(['notice-1'], expect.any(AbortSignal))
})

test('shows the notification list and marks it all as read', async () => {
  const user = userEvent.setup()
  const markAsRead = vi.fn()
  render(
    <NotificationsContext.Provider
      value={{
        notifications: [
          {
            id: 'notice-1',
            title: 'New message',
            message: 'New message from alex',
            created_at: '2026-10-27T10:00:00Z',
            is_read: false,
          },
        ],
        unreadCount: 1,
        loading: false,
        error: '',
        desktopPermission: 'unsupported',
        refresh: vi.fn(),
        markAsRead,
        requestDesktopPermission: vi.fn(),
      }}
    >
      <NotificationCenter />
    </NotificationsContext.Provider>,
  )

  await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
  const panel = screen.getByRole('dialog', { name: 'Notifications' })
  expect(panel).toHaveTextContent('New message from alex')
  await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
  expect(markAsRead).toHaveBeenCalledWith(null)
  expect(screen.getByRole('link', { name: 'View all notifications' })).toHaveAttribute('href', '#/notifications')
})
