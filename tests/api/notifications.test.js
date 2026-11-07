import { expect, test, vi } from 'vitest'
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markMessageNotificationsReadFromSender,
  markNotificationsRead,
  notificationDestination,
} from '../../src/api/notifications'
import { jsonResponse } from '../helpers'

const item = {
  id: 'notice-1',
  user_id: 7,
  title: 'Hello',
  message: 'An update',
  is_read: false,
  created_at: '2026-10-29T10:00:00Z',
  type: 'friend_request',
  data: { sender_id: 8 },
}

test('authenticated list/count requests use the backend pagination contract and abort signal', async () => {
  localStorage.setItem('vstore:token', 'test-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      jsonResponse(
        url.endsWith('/unread-count')
          ? { unread_count: 3 }
          : { items: [item], total: 80, unread_count: 3 },
      ),
    ),
  )
  const controller = new AbortController()
  const result = await getNotifications(
    { limit: 5, offset: 2, unread_only: true },
    controller.signal,
  )
  expect(result).toEqual({ items: [item], total: 80, unread_count: 3 })
  expect(await getUnreadCount()).toBe(3)
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/notifications?limit=5&offset=2&unread_only=true')
  expect(fetch.mock.calls[0][1]).toMatchObject({
    credentials: 'include',
    headers: { Authorization: 'Bearer test-token' },
  })
  controller.abort()
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
})

test('selected reads deduplicate IDs; only explicit null marks all; deletion encodes IDs', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) =>
      options.method === 'DELETE' ? jsonResponse(null, 204) : jsonResponse({ marked_count: 1 }),
    ),
  )
  await markNotificationsRead(['notice-1', 'notice-1'])
  await markNotificationsRead(null)
  await deleteNotification('notice/1')
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ notification_ids: ['notice-1'] })
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ notification_ids: null })
  expect(fetch.mock.calls[0][1].method).toBe('POST')
  expect(fetch.mock.calls[2][0]).toBe('/api/v1/notifications/notice%2F1')
  expect(fetch.mock.calls[2][1].method).toBe('DELETE')
})

test('marks unread message notifications from one sender across notification pages', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    ...item,
    id: `notice-${index}`,
    type: index === 0 ? 'new_message' : 'friend_request',
    data: { sender_id: 8 },
  }))
  const secondPage = [
    { ...item, id: 'notice-100', type: 'new_message', data: { sender_id: 8 } },
    { ...item, id: 'notice-101', type: 'new_message', data: { sender_id: 9 } },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (options.method === 'POST') return jsonResponse({ marked_count: 2 })
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'))
      return jsonResponse({
        items: offset ? secondPage : firstPage,
        total: 102,
        unread_count: 102,
      })
    }),
  )

  expect(await markMessageNotificationsReadFromSender(8)).toBe(2)
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/notifications?limit=100&offset=0&unread_only=false',
    '/api/v1/notifications?limit=100&offset=100&unread_only=false',
    '/api/v1/notifications/read',
  ])
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
    notification_ids: ['notice-0', 'notice-100'],
  })
})

test.each([[], undefined, [''], [null]])(
  'rejects unsafe selection %j without accidentally marking all',
  async (ids) => {
    await expect(markNotificationsRead(ids)).rejects.toThrow('Select at least one')
    expect(fetch).not.toHaveBeenCalled()
  },
)

test.each([
  { items: [], total: 1, unread_count: 2 },
  { items: [], total: '1', unread_count: 0 },
  { items: [{ ...item, title: {} }], total: 1, unread_count: 1 },
  { items: [{ ...item, created_at: 'invalid' }], total: 1, unread_count: 1 },
  { items: [item, item], total: 2, unread_count: 2 },
])('rejects malformed list response %#', async (data) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(data)),
  )
  await expect(getNotifications()).rejects.toThrow(/Could not read/)
})

test('rejects malformed counts and ambiguous mutation acknowledgements', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ unread_count: -1 })),
  )
  await expect(getUnreadCount()).rejects.toThrow('Could not read')
  await expect(markNotificationsRead(null)).rejects.toThrow('Could not confirm')
})

test('builds supported internal destinations; ignores arbitrary links and path injection', () => {
  expect(notificationDestination(item)).toEqual({ href: '#/users/8', label: 'View profile' })
  expect(notificationDestination({ type: 'friend_accepted', data: { friend_id: 9 } }).href).toBe(
    '#/users/9',
  )
  expect(notificationDestination({ data: { game_id: 'a-game-uuid' } }).href).toBe(
    '#/games/a-game-uuid',
  )
  expect(notificationDestination({ data: { news_id: 12 } }).href).toBe('#/news/12')
  expect(
    notificationDestination({ type: 'support_ticket_reply', data: { ticket_id: 12 } }),
  ).toEqual({ href: '#/support?request=12', label: 'Open support request' })
  expect(
    notificationDestination({ type: 'support_ticket_assigned', data: { ticket_id: 12 } }),
  ).toEqual({ href: '#/support?request=12', label: 'Open support request' })
  expect(
    notificationDestination({
      type: 'support_ticket_reply',
      data: { ticket_id: '12/../../admin' },
    }),
  ).toBeNull()
  for (const data of [
    { url: 'javascript:alert(1)' },
    { href: 'https://example.com' },
    { user_id: '//evil' },
    { game_id: '../account' },
    { game_id: 'game?redirect=evil' },
  ])
    expect(notificationDestination({ data })).toBeNull()
})
