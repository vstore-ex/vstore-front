import { expect, test, vi } from 'vitest'
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportArticles,
  getSupportArticle,
  getSupportTicketDetails,
  getSupportTicketMessages,
  sendSupportTicketMessage,
} from '../../src/api/support'
import { jsonResponse } from '../helpers'

const article = {
  id: 3,
  title: 'Refunds',
  content_md: 'Read the **refund policy**.',
  category: 'Payments',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
}
const ticket = {
  id: 9,
  user_id: 7,
  subject: 'Payment failed',
  message: 'The payment did not go through.',
  status: 'open',
  priority: 'high',
  message_count: 1,
  last_message_at: '2026-11-05T10:00:00Z',
  created_at: '2026-11-05T10:00:00Z',
  updated_at: '2026-11-05T10:00:00Z',
}
const reply = {
  id: 21,
  ticket_id: 9,
  sender_id: 1,
  sender_username: 'admin_test',
  sender_role: 'staff',
  body: 'We are reviewing it.',
  created_at: '2026-11-05T10:05:00Z',
}

test('loads public support articles with backend search and pagination', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({ items: [article], total: 9, page: 2, page_size: 8, total_pages: 2 }),
    ),
  )
  localStorage.setItem('vstore:token', 'support-token')
  const controller = new AbortController()

  expect(
    await getSupportArticles({ page: 2, pageSize: 8, q: ' Refund ' }, controller.signal),
  ).toEqual({
    items: [article],
    total: 9,
    page: 2,
    page_size: 8,
    total_pages: 2,
  })
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/articles?page=2&page_size=8&q=Refund')
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'omit', signal: controller.signal })
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
})

test('loads and creates only the signed-in user’s support tickets', async () => {
  localStorage.setItem('vstore:token', 'support-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => jsonResponse(options.method === 'POST' ? ticket : [ticket])),
  )
  const controller = new AbortController()

  expect(await getMySupportTickets(7, controller.signal)).toEqual([ticket])
  expect(
    await createSupportTicket(
      { subject: ' Payment failed ', message: ' No response ', priority: 'high' },
      7,
      controller.signal,
    ),
  ).toEqual(ticket)
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/me/tickets')
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/tickets')
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: 'Bearer support-token' },
    signal: controller.signal,
  })
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    subject: 'Payment failed',
    message: 'No response',
    priority: 'high',
  })
})

test('loads and posts validated ticket conversation messages', async () => {
  localStorage.setItem('vstore:token', 'support-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) =>
      jsonResponse(options.method === 'POST' ? { ...reply, body: 'A response from me.' } : [reply]),
    ),
  )
  const controller = new AbortController()

  expect(await getSupportTicketMessages(9, controller.signal)).toEqual([reply])
  expect(await sendSupportTicketMessage(9, ' A response from me. ', controller.signal)).toEqual({
    ...reply,
    body: 'A response from me.',
  })
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/tickets/9/messages')
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/tickets/9/messages')
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: 'POST',
    headers: { Authorization: 'Bearer support-token' },
    signal: controller.signal,
  })
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ body: 'A response from me.' })
  await expect(sendSupportTicketMessage('9/10', 'unsafe')).rejects.toThrow(
    'Invalid support request ID',
  )
})

test('loads only the signed-in user’s ticket history and status events', async () => {
  localStorage.setItem('vstore:token', 'support-token')
  const event = {
    id: 31,
    ticket_id: 9,
    actor_id: 1,
    actor_username: 'admin_test',
    event_type: 'status_changed',
    old_value: 'open',
    new_value: 'waiting_for_customer',
    created_at: '2026-11-05T10:05:00Z',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ ...ticket, messages: [reply], events: [event] })),
  )

  const result = await getSupportTicketDetails(9, 7)
  expect(result.messages).toEqual([reply])
  expect(result.events).toEqual([event])
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/tickets/9')
  expect(fetch.mock.calls[0][1].headers).toMatchObject({
    Authorization: 'Bearer support-token',
  })
  await expect(getSupportTicketDetails(9, 8)).rejects.toThrow('Could not read support data')
  expect(fetch).toHaveBeenCalledTimes(2)
})

test.each([{ page: 0 }, { pageSize: 101 }, { q: 'x'.repeat(201) }])(
  'rejects invalid support article queries before requesting',
  async (query) => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(getSupportArticles(query)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('validates user identity, ticket fields, and private ticket ownership', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse([ticket])),
  )
  await expect(getMySupportTickets(8)).rejects.toThrow('Could not read support data')
  await expect(createSupportTicket({ subject: ' ', message: 'Details' }, 7)).rejects.toThrow(
    'Subject must contain',
  )
  await expect(
    createSupportTicket({ subject: 'Help', message: 'Details', priority: 'urgent' }, 7),
  ).rejects.toThrow('priority')
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/me/tickets'])
})

test('rejects malformed support article pagination metadata', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({ items: [article], total: 8, page: 1, page_size: 8, total_pages: 2 }),
    ),
  )
  await expect(getSupportArticles()).rejects.toThrow('Could not read support data')
})

test('loads and validates a public help article without authentication', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(article)))
  expect(await getSupportArticle(3)).toMatchObject(article)
  expect(fetch).toHaveBeenCalledWith('/api/v1/articles/3', expect.objectContaining({ credentials: 'omit' }))
  await expect(getSupportArticle('../me')).rejects.toThrow('Invalid help article ID')
  expect(fetch).toHaveBeenCalledTimes(1)
})
