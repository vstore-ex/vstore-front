import { expect, test, vi } from 'vitest'
import {
  getConversations,
  getConversation,
  getMessages,
  getMessageAttachment,
  openConversation,
  sendMessage,
  messageFilesError,
  markConversationRead,
  mergeMessages,
} from '../../src/api/messages'
import { notificationDestination } from '../../src/api/notifications'
import { jsonResponse } from '../helpers'
import { message, conversation } from '../message-fixtures'

test('uses authenticated conversation pagination, cursor history and JSON writes', async () => {
  localStorage.setItem('vstore:token', 'message-test-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (url.endsWith('/read')) return jsonResponse({ marked_count: 1 })
      if (url.endsWith('/messages') && options.method === 'POST') return jsonResponse(message(9))
      if (url.includes('/messages?'))
        return jsonResponse({ items: [message(1)], next_before_id: null })
      return jsonResponse(options.method === 'POST' ? conversation() : [conversation()])
    }),
  )
  const controller = new AbortController()
  await getConversations({ skip: 20, limit: 20 }, controller.signal)
  await getMessages('12', { before_id: 9, limit: 20 }, controller.signal)
  await openConversation(8, controller.signal)
  await sendMessage(12, ' Hello ', controller.signal)
  expect(await markConversationRead(12, controller.signal)).toBe(1)
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/messages/conversations?skip=20&limit=20',
    '/api/v1/messages/conversations/12/messages?limit=20&before_id=9',
    '/api/v1/messages/conversations',
    '/api/v1/messages/conversations/12/messages',
    '/api/v1/messages/conversations/12/read',
  ])
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ recipient_id: 8 })
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ content: 'Hello' })
  for (const [, options] of fetch.mock.calls)
    expect(options).toMatchObject({
      credentials: 'include',
      headers: { Authorization: 'Bearer message-test-token' },
    })
  controller.abort()
  expect(fetch.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true)
})
test('resolves a deep-linked conversation beyond the first list page', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      jsonResponse(
        url.includes('skip=0&')
          ? Array.from({ length: 100 }, (_, i) => conversation(i + 1))
          : [conversation(123)],
      ),
    ),
  )
  expect((await getConversation(123)).id).toBe(123)
  expect(fetch.mock.calls[1][0]).toContain('skip=100&limit=100')
  await expect(getConversation(999)).rejects.toMatchObject({ status: 404 })
})
test.each([0, -1, '12/../users', '1?skip=2', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid IDs %s before a request',
  async (id) => {
    await expect(getMessages(id)).rejects.toThrow('Invalid')
    await expect(openConversation(id)).rejects.toThrow('Invalid')
    expect(fetch).not.toHaveBeenCalled()
  },
)
test.each(['', '   ', 'x'.repeat(4001)])(
  'rejects an empty or oversized text draft %#',
  async (content) => {
    await expect(sendMessage(12, content)).rejects.toThrow('4000')
    expect(fetch).not.toHaveBeenCalled()
  },
)
test('sends image attachments as authenticated multipart data and downloads only validated private URLs', async () => {
  const file = new File(['image bytes'], 'art.png', { type: 'image/png' })
  const sentMessage = message(9, {
    content: null,
    attachments: [
      {
        id: 3,
        content_type: 'image/webp',
        size_bytes: 11,
        download_url: '/api/v1/messages/conversations/12/attachments/3',
      },
    ],
  })
  localStorage.setItem('vstore:token', 'message-test-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      url.endsWith('/attachments/3')
        ? new Response('private image', {
            headers: { 'Content-Type': 'image/webp' },
          })
        : jsonResponse(sentMessage),
    ),
  )
  const result = await sendMessage(12, '  ', undefined, [file])
  const request = fetch.mock.calls[0]
  expect(request[0]).toBe('/api/v1/messages/conversations/12/messages')
  expect(request[1].body).toBeInstanceOf(FormData)
  expect(request[1].body.get('content')).toBeNull()
  expect(request[1].body.getAll('files')).toHaveLength(1)
  expect(request[1].body.get('files').name).toBe('art.png')
  expect(request[1].headers).toMatchObject({ Authorization: 'Bearer message-test-token' })
  expect(request[1].headers['Content-Type']).toBeUndefined()
  expect(result.attachments).toHaveLength(1)

  const blob = await getMessageAttachment(12, result.attachments[0])
  expect(blob.type).toBe('image/webp')
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/messages/conversations/12/attachments/3')
  expect(fetch.mock.calls[1][1].headers).toMatchObject({
    Authorization: 'Bearer message-test-token',
  })
  await expect(
    getMessageAttachment(12, {
      ...result.attachments[0],
      download_url: 'https://cdn.example/private.webp',
    }),
  ).rejects.toThrow('Could not read')
  expect(fetch).toHaveBeenCalledTimes(2)
})
test('validates attachment count, MIME type, and backend size limits', () => {
  const image = (size, type = 'image/png') =>
    new File([new Uint8Array(size)], 'image.png', { type })
  expect(messageFilesError([image(1)])).toBe('')
  expect(messageFilesError([image(1, 'text/plain')])).toBe('Only image files can be attached.')
  expect(messageFilesError([image(0)])).toBe('Images cannot be empty.')
  expect(messageFilesError([image(5 * 1024 * 1024 + 1)])).toBe(
    'Each image must be 5 MiB or smaller.',
  )
  expect(messageFilesError(Array.from({ length: 4 }, () => image(4 * 1024 * 1024)))).toBe(
    'All images together must be 15 MiB or smaller.',
  )
  expect(messageFilesError(Array.from({ length: 6 }, () => image(1)))).toBe(
    'Attach up to 5 images.',
  )
})
test.each([
  { items: [message(1, { conversation_id: 99 })], next_before_id: null },
  { items: [message(1)], next_before_id: 3 },
  { items: [], next_before_id: 1 },
  { items: [message(1, { content: {} })], next_before_id: null },
])('rejects wrong-conversation payloads and broken cursors %#', async (data) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(data)),
  )
  await expect(getMessages(12)).rejects.toThrow('Could not read')
})
test('does not claim a malformed read acknowledgement succeeded', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({})),
  )
  await expect(markConversationRead(12)).rejects.toThrow('Could not confirm')
})
test('merges out-of-order duplicates by ID without regressing confirmed read state', () => {
  const result = mergeMessages(
    [message(2, { read_at: '2026-11-03T11:00:00Z' })],
    [message(3), message(2), message(1)],
  )
  expect(result.map((item) => item.id)).toEqual([1, 2, 3])
  expect(result[1].read_at).toBeTruthy()
})
test('message notifications only link to a validated local conversation', () => {
  expect(notificationDestination({ type: 'new_message', data: { conversation_id: 12 } })).toEqual({
    href: '#/messages/12',
    label: 'Open conversation',
  })
  expect(
    notificationDestination({
      type: 'new_message',
      data: { conversation_id: 'https://evil.test' },
    }),
  ).toBeNull()
})
