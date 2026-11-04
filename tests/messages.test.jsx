import { useEffect, useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import NotificationsProvider from '../src/notifications/NotificationsProvider'
import MessagesPage from '../src/pages/MessagesPage/MessagesPage'
import StartConversationButton from '../src/messages/StartConversationButton'
import { apiRequest } from '../src/api/client'
import { deferred } from './helpers'
import { conversation, message, incomingEvent } from './message-fixtures'

vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
let conversations, records, sockets, requests, failures, intercept, unexpected, owner
class Socket {
  constructor() {
    sockets.push(this)
  }
  close() {
    this.closed = true
    this.onclose?.({ code: 1000 })
  }
}
const clone = (value) => JSON.parse(JSON.stringify(value))
beforeEach(() => {
  owner = 7
  conversations = [
    conversation(),
    conversation(14, { other_user: { id: 9, username: 'sam' }, unread_count: 0 }),
  ]
  records = {
    12: [message(1)],
    14: [
      message(2, {
        conversation_id: 14,
        sender: { id: 9, username: 'sam' },
        content: 'Hi from Sam',
        read_at: '2026-11-03T10:01:00Z',
      }),
    ],
  }
  sockets = []
  requests = []
  failures = {}
  unexpected = []
  intercept = null
  vi.stubGlobal('WebSocket', Socket)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  apiRequest.mockReset().mockImplementation(async (path, options = {}) => {
    requests.push({ path, ...options })
    const url = new URL(path, 'http://localhost')
    const kind = url.pathname.endsWith('/read')
      ? 'read'
      : url.pathname.endsWith('/messages')
        ? options.method === 'POST'
          ? 'send'
          : 'messages'
        : path.startsWith('/messages/conversations')
          ? options.method === 'POST'
            ? 'open'
            : 'inbox'
          : 'notifications'
    if (intercept) {
      const value = intercept(path, options, kind)
      if (value !== undefined) return value
    }
    if (failures[kind]) throw failures[kind]
    if (path === '/notifications/unread-count') return { unread_count: 0 }
    if (path.startsWith('/notifications?')) return { items: [], unread_count: 0, total: 0 }
    if (path === '/messages/conversations' && options.method === 'POST')
      return clone(conversations.find((item) => item.other_user.id === options.body.recipient_id))
    if (path.startsWith('/messages/conversations?')) {
      const skip = Number(url.searchParams.get('skip')),
        limit = Number(url.searchParams.get('limit'))
      return clone(
        conversations.slice(skip, skip + limit).map((item) => {
          const list = records[item.id] || [],
            last = list.at(-1)
          return {
            ...item,
            unread_count: list.filter((m) => m.sender.id !== owner && !m.read_at).length,
            last_message: last
              ? { ...last, sender_id: last.sender.id, has_attachments: !!last.attachments.length }
              : null,
          }
        }),
      )
    }
    const match = url.pathname.match(/^\/messages\/conversations\/(\d+)\/(messages|read)$/)
    if (match) {
      const id = Number(match[1]),
        list = records[id] || []
      if (match[2] === 'read') {
        let count = 0
        for (const item of list)
          if (item.sender.id !== owner && !item.read_at) {
            item.read_at = '2026-11-03T10:01:00Z'
            count++
          }
        return { marked_count: count }
      }
      if (options.method === 'POST') {
        const item = message(
          Math.max(
            0,
            ...Object.values(records)
              .flat()
              .map((m) => m.id),
          ) + 1,
          {
            conversation_id: id,
            content: options.body.content,
            sender: { id: owner, username: 'reader' },
          },
        )
        list.push(item)
        return clone(item)
      }
      const before = Number(url.searchParams.get('before_id')) || Infinity,
        limit = Number(url.searchParams.get('limit'))
      const filtered = list.filter((m) => m.id < before),
        items = filtered.slice(-limit)
      return clone({ items, next_before_id: filtered.length > limit ? items[0].id : null })
    }
    unexpected.push(path)
    throw new Error('Unexpected API request: ' + path)
  })
})
afterEach(() => expect(unexpected).toEqual([]))
function Harness({ initialUser = 7, initialConversation = '12' }) {
  const [user, setUser] = useState(initialUser)
  const [id, setId] = useState(initialConversation)
  useEffect(() => {
    const route = () => setId(window.location.hash.match(/^#\/messages\/(\d+)$/)?.[1] || null)
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])
  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!user, currentUser: user ? { id: user } : null }}
    >
      <NotificationsProvider>
        <button onClick={() => setUser(null)}>Logout</button>
        <button onClick={() => setUser(8)}>Switch account</button>
        <button onClick={() => setId('14')}>Other conversation</button>
        <button onClick={() => setId('12')}>First conversation</button>
        <StartConversationButton userId={8} />
        <MessagesPage conversationId={id} />
      </NotificationsProvider>
    </AuthContext.Provider>
  )
}
async function setup(props) {
  const id = Object.hasOwn(props || {}, 'initialConversation') ? props.initialConversation : '12'
  window.history.replaceState(null, '', '/#/messages' + (id ? '/' + id : ''))
  const view = render(<Harness {...props} />)
  return { ...view, user: userEvent.setup() }
}
const history = () => screen.getByRole('log', { name: 'Conversation messages' })
const messageRequests = () => requests.filter((item) => /\/messages\?/.test(item.path))
const reads = () => requests.filter((item) => item.path.endsWith('/read'))
async function emit(event) {
  await act(async () => sockets.at(-1).onmessage({ data: JSON.stringify(event) }))
}

test('loads private history, marks incoming messages read and updates the inbox', async () => {
  await setup()
  expect(
    await screen.findByRole('heading', { name: 'Conversation with @alex' }),
  ).toBeInTheDocument()
  expect(within(history()).getByText('Message 1')).toBeInTheDocument()
  await waitFor(() => expect(reads()).toHaveLength(1))
  await waitFor(() => expect(screen.queryByLabelText('1 unread messages')).toBeNull())
  expect(sockets).toHaveLength(1)
})
test('loads older messages using before_id and does not duplicate messages', async () => {
  records[12] = Array.from({ length: 61 }, (_, i) => message(i + 1))
  const { user } = await setup()
  await screen.findByRole('button', { name: 'Load older messages' })
  expect(within(history()).getAllByRole('listitem')).toHaveLength(50)
  await user.click(screen.getByRole('button', { name: 'Load older messages' }))
  await waitFor(() => expect(within(history()).getAllByRole('listitem')).toHaveLength(61))
  expect(messageRequests().some((item) => item.path.includes('before_id=12'))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Load older messages' })).toBeNull()
})
test('paginates the inbox and preserves the current page through a failed next-page request', async () => {
  conversations = Array.from({ length: 21 }, (_, i) =>
    conversation(i + 1, { other_user: { id: i + 100, username: 'friend-' + i } }),
  )
  const { user } = await setup({ initialConversation: null })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeEnabled(),
  )
  failures.inbox = new Error('Inbox unavailable')
  await user.click(screen.getByRole('button', { name: 'Next', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Inbox unavailable')
  expect(screen.getByText('Page 1')).toBeInTheDocument()
  expect(screen.getByText('@friend-0')).toBeInTheDocument()
  failures.inbox = null
  await user.click(screen.getByRole('button', { name: 'Retry conversations' }))
  await screen.findByText('Page 2')
  expect(screen.getByText('@friend-20')).toBeInTheDocument()
})
test('preserves an unsent draft on failure and sends plain text once on explicit retry', async () => {
  const { user } = await setup()
  const input = await screen.findByRole('textbox', { name: 'Your message' })
  await waitFor(() => expect(input).toBeEnabled())
  const text = '<script>alert(1)</script> Hello!'
  await user.type(input, text)
  failures.send = new Error('Send unavailable')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  expect(await screen.findByText('Send unavailable')).toBeInTheDocument()
  expect(input).toHaveValue(text)
  failures.send = null
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  expect(await screen.findByText('Message sent.')).toBeInTheDocument()
  expect(input).toHaveValue('')
  expect(within(history()).getByText(text)).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
  expect(records[12].filter((item) => item.content === text)).toHaveLength(1)
})
test('locks sending while pending and limits the draft to 4000 characters', async () => {
  const { user } = await setup()
  const input = screen.getByRole('textbox', { name: 'Your message' })
  await waitFor(() => expect(input).toBeEnabled())
  expect(input).toHaveAttribute('maxLength', '4000')
  const pending = deferred()
  intercept = (_path, _options, kind) => (kind === 'send' ? pending.promise : undefined)
  await user.type(input, 'Hello')
  await user.dblClick(screen.getByRole('button', { name: 'Send message' }))
  expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled()
  expect(input).toBeDisabled()
  expect(
    requests.filter((item) => item.method === 'POST' && item.path.endsWith('/messages')),
  ).toHaveLength(1)
  await act(async () =>
    pending.resolve(message(3, { sender: { id: 7, username: 'reader' }, content: 'Hello' })),
  )
  await screen.findByText('Message sent.')
})
test('keeps per-conversation drafts in memory, without copying them to another conversation', async () => {
  const { user } = await setup()
  const input = screen.getByRole('textbox', { name: 'Your message' })
  await waitFor(() => expect(input).toBeEnabled())
  await user.type(input, 'Private draft for Alex')
  await user.click(screen.getByRole('button', { name: 'Other conversation' }))
  expect(await screen.findByRole('heading', { name: 'Conversation with @sam' })).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'First conversation' }))
  expect(screen.getByRole('textbox')).toHaveValue('Private draft for Alex')
  expect(localStorage.length).toBe(0)
})
test('respects read-only conversations and handles rejected friendship on opening', async () => {
  conversations[0].can_send = false
  const { user } = await setup()
  await screen.findByText(/This conversation is read-only/)
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  failures.open = Object.assign(new Error('Forbidden'), { status: 403 })
  await user.click(screen.getByRole('button', { name: 'Message', exact: true }))
  expect(await screen.findByText(/Only accepted friends/)).toBeInTheDocument()
})
test.each([401, 403, 404])('clears private history after a %s response', async (status) => {
  const { user } = await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  failures.messages = Object.assign(new Error('Denied'), { status })
  await user.click(screen.getByRole('button', { name: 'Refresh messages' }))
  await waitFor(() => expect(screen.queryByRole('log')).toBeNull())
  expect(screen.queryByRole('heading', { name: 'Conversation with @alex' })).toBeNull()
  expect(screen.getByRole('textbox')).toBeDisabled()
})
test('retains the recoverable conversation after transient refresh and read failures', async () => {
  failures.read = new Error('Read unavailable')
  const { user } = await setup()
  await screen.findByText('Read unavailable')
  expect(screen.getByLabelText('1 unread messages')).toBeInTheDocument()
  failures.messages = new Error('History unavailable')
  await user.click(screen.getByRole('button', { name: 'Refresh messages' }))
  await screen.findByText('History unavailable')
  expect(within(history()).getByText('Message 1')).toBeInTheDocument()
  failures.messages = null
  failures.read = null
  await user.click(screen.getByRole('button', { name: 'Retry messages' }))
  await waitFor(() => expect(screen.queryByText('History unavailable')).toBeNull())
  await waitFor(() => expect(screen.queryByLabelText('1 unread messages')).toBeNull())
})
test('guests do not fetch private data or open a socket', async () => {
  await setup({ initialUser: null })
  expect(screen.getByText('Please sign in to view your messages.')).toBeInTheDocument()
  expect(requests).toHaveLength(0)
  expect(sockets).toHaveLength(0)
})
test('aborts a previous conversation request and ignores its late response', async () => {
  const pending = deferred()
  intercept = (path, _options, kind) =>
    kind === 'messages' && path.includes('/12/') ? pending.promise : undefined
  const { user } = await setup()
  await waitFor(() => expect(messageRequests()).toHaveLength(1))
  const signal = messageRequests()[0].signal
  await user.click(screen.getByRole('button', { name: 'Other conversation' }))
  await screen.findByRole('heading', { name: 'Conversation with @sam' })
  await act(async () =>
    pending.resolve({
      items: [message(1, { content: 'Old private response' })],
      next_before_id: null,
    }),
  )
  expect(signal.aborted).toBe(true)
  expect(screen.queryByText('Old private response')).toBeNull()
})
test('account switch drops private drafts and ignores a previous send result; logout closes the socket', async () => {
  const { user } = await setup()
  const input = screen.getByRole('textbox')
  await waitFor(() => expect(input).toBeEnabled())
  await user.type(input, 'Old account draft')
  const pending = deferred()
  intercept = (_path, _options, kind) => (kind === 'send' ? pending.promise : undefined)
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  const sending = requests.find((item) => item.method === 'POST' && item.path.endsWith('/messages'))
  owner = 8
  conversations = [conversation(12, { other_user: { id: 7, username: 'reader' } })]
  records[12] = []
  await user.click(screen.getByRole('button', { name: 'Switch account' }))
  expect(sending.signal.aborted).toBe(true)
  await screen.findByRole('heading', { name: 'Conversation with @reader' })
  await act(async () =>
    pending.resolve(
      message(9, { sender: { id: 7, username: 'reader' }, content: 'Old account draft' }),
    ),
  )
  expect(screen.getByRole('textbox')).toHaveValue('')
  expect(screen.queryByText('Old account draft')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Logout' }))
  expect(sockets.every((socket) => socket.closed)).toBe(true)
  expect(screen.queryByRole('textbox')).toBeNull()
})
test('new-message events update only the matching conversation and deduplicate delivery', async () => {
  await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  await waitFor(() => expect(reads()).toHaveLength(1))
  records[12].push(message(3, { content: 'Live update' }))
  await emit(incomingEvent(3))
  await waitFor(() => expect(within(history()).getByText('Live update')).toBeInTheDocument())
  await waitFor(() => expect(reads()).toHaveLength(2))
  const count = messageRequests().length
  await emit(incomingEvent(3))
  expect(messageRequests()).toHaveLength(count)
  records[14].push(
    message(4, {
      conversation_id: 14,
      sender: { id: 9, username: 'sam' },
      content: 'Background update',
    }),
  )
  await emit(incomingEvent(4, 14, 9))
  await screen.findByText('Background update')
  expect(messageRequests()).toHaveLength(count)
  expect(within(history()).queryByText('Background update')).toBeNull()
  expect(screen.getByRole('link', { name: 'Open conversation' })).toHaveAttribute(
    'href',
    '#/messages/14',
  )
  expect(sockets).toHaveLength(1)
})
test('hidden conversations stay unread until the tab becomes visible', async () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  expect(reads()).toHaveLength(0)
  records[12].push(message(3))
  await emit(incomingEvent(3))
  await waitFor(() => expect(within(history()).getByText('Message 3')).toBeInTheDocument())
  expect(reads()).toHaveLength(0)
  visibility.mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(reads()).toHaveLength(1))
  await waitFor(() => expect(screen.queryByLabelText('2 unread messages')).toBeNull())
})
test('reconnect backfills more than one missed page and keeps already loaded history', async () => {
  await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  await act(async () => sockets[0].onopen())
  await act(async () => sockets[0].close())
  records[12].push(...Array.from({ length: 105 }, (_, i) => message(i + 3)))
  await waitFor(() => expect(sockets).toHaveLength(2), { timeout: 4000 })
  await act(async () => sockets[1].onopen())
  await waitFor(() => expect(within(history()).getAllByRole('listitem')).toHaveLength(106))
  expect(
    messageRequests().filter((item) => item.path.includes('before_id=')).length,
  ).toBeGreaterThanOrEqual(2)
  expect(within(history()).getByText('Message 1')).toBeInTheDocument()
})
test('desktop notifications open their conversation and are disposed when the session ends', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  vi.spyOn(window, 'focus').mockImplementation(() => {})
  const native = []
  class Desktop {
    static permission = 'granted'
    constructor() {
      native.push(this)
    }
    close() {
      this.closed = true
      this.onclose?.()
    }
  }
  vi.stubGlobal('Notification', Desktop)
  const { user } = await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  await emit(incomingEvent(4, 14, 9))
  expect(native).toHaveLength(1)
  await act(async () => native[0].onclick())
  expect(window.location.hash).toBe('#/messages/14')
  await emit(incomingEvent(5, 14, 9))
  await user.click(screen.getByRole('button', { name: 'Logout' }))
  expect(native.every((item) => item.closed)).toBe(true)
  window.location.hash = '#/discover'
  await act(async () => native[1].onclick())
  expect(window.location.hash).toBe('#/discover')
})
test('opens or creates an accepted friend conversation from the Message button', async () => {
  const { user } = await setup({ initialConversation: null })
  await user.click(screen.getByRole('button', { name: 'Message', exact: true }))
  expect(
    await screen.findByRole('heading', { name: 'Conversation with @alex' }),
  ).toBeInTheDocument()
  expect(
    requests.find((item) => item.path === '/messages/conversations' && item.method === 'POST').body,
  ).toEqual({ recipient_id: 8 })
})

test('keeps a draft but hides conversation data when sending is forbidden', async () => {
  const { user } = await setup()
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled())
  await user.type(screen.getByRole('textbox'), 'My unsent draft')
  failures.send = Object.assign(new Error('No longer friends'), { status: 403 })
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(screen.queryByRole('log')).toBeNull())
  expect(screen.getByRole('textbox')).toHaveValue('My unsent draft')
  expect(screen.getByRole('textbox')).toBeDisabled()
})

test('a failed older-page request preserves history and cursor for retry', async () => {
  records[12] = Array.from({ length: 61 }, (_, i) => message(i + 1))
  const { user } = await setup()
  await screen.findByRole('button', { name: 'Load older messages' })
  intercept = (path, _options, kind) =>
    kind === 'messages' && path.includes('before_id=')
      ? Promise.reject(new Error('Older history unavailable'))
      : undefined
  await user.click(screen.getByRole('button', { name: 'Load older messages' }))
  await screen.findByText('Older history unavailable')
  expect(within(history()).getAllByRole('listitem')).toHaveLength(50)
  intercept = null
  await user.click(screen.getByRole('button', { name: 'Load older messages' }))
  await waitFor(() => expect(within(history()).getAllByRole('listitem')).toHaveLength(61))
})

test('ignores malformed events and delivers valid messages even if notification refresh fails', async () => {
  await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  const count = messageRequests().length
  await emit({
    type: 'new_message',
    data: { message_id: 3, conversation_id: '12/../users', sender_id: 8 },
  })
  await emit({ type: 'other_event', data: { message_id: 3, conversation_id: 12, sender_id: 8 } })
  expect(messageRequests()).toHaveLength(count)
  failures.notifications = new Error('Notifications unavailable')
  records[12].push(message(3, { content: 'Delivered independently' }))
  await emit(incomingEvent(3))
  await waitFor(() =>
    expect(within(history()).getByText('Delivered independently')).toBeInTheDocument(),
  )
})

test('incoming messages during an outstanding read are marked by a subsequent read', async () => {
  const pending = deferred()
  let held = false
  intercept = (_path, _options, kind) => {
    if (kind === 'read' && !held) {
      held = true
      return pending.promise
    }
  }
  await setup()
  await waitFor(() => expect(reads()).toHaveLength(1))
  records[12].push(message(3))
  await emit(incomingEvent(3))
  await waitFor(() => expect(within(history()).getByText('Message 3')).toBeInTheDocument())
  await act(async () => pending.resolve({ marked_count: 1 }))
  await waitFor(() => expect(reads()).toHaveLength(2))
  await waitFor(() => expect(screen.queryByLabelText('2 unread messages')).toBeNull())
})

test('stops reconnecting after recovery rejects the session and cleans up retry timers', async () => {
  const { unmount } = await setup()
  await screen.findByRole('heading', { name: 'Conversation with @alex' })
  await act(async () => sockets[0].onopen())
  vi.useFakeTimers()
  try {
    failures.notifications = Object.assign(new Error('Expired session'), { status: 401 })
    await act(async () => {
      sockets[0].close()
      await vi.advanceTimersByTimeAsync(1000)
    })
    await act(async () => vi.advanceTimersByTimeAsync(60000))
    expect(sockets).toHaveLength(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

test('live updates do not cancel the user destination during inbox pagination', async () => {
  conversations = Array.from({ length: 21 }, (_, i) =>
    conversation(i + 1, { other_user: { id: i + 100, username: 'friend-' + i } }),
  )
  const { user } = await setup({ initialConversation: null })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeEnabled(),
  )
  const pending = deferred()
  let held = false
  intercept = (path, _options, kind) => {
    if (kind === 'inbox' && path.includes('skip=20&') && !held) {
      held = true
      return pending.promise
    }
  }
  await user.click(screen.getByRole('button', { name: 'Next', exact: true }))
  const waiting = requests.find((item) => item.path.includes('skip=20&'))
  await emit(incomingEvent(500, 14, 9))
  await screen.findByText('Page 2')
  expect(screen.getByText('@friend-20')).toBeInTheDocument()
  await act(async () => pending.resolve([conversations[20]]))
  expect(waiting.signal.aborted).toBe(true)
  expect(screen.getByText('Page 2')).toBeInTheDocument()
})
