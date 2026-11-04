import { apiRequest, ApiError, mediaUrl } from './client'

export const isMessageId = (value) => Number.isSafeInteger(value) && value > 0
function id(value) {
  const parsed = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value
  if (!isMessageId(parsed)) throw new Error('Invalid conversation or user ID.')
  return parsed
}
function unreadable() {
  throw new Error('Could not read the conversation. Please refresh.')
}
function person(value) {
  if (!isMessageId(value?.id) || typeof value.username !== 'string') unreadable()
  return { ...value, avatar: mediaUrl(value.avatar) }
}
function conversation(value) {
  if (
    !isMessageId(value?.id) ||
    typeof value.can_send !== 'boolean' ||
    !Number.isSafeInteger(value.unread_count) ||
    value.unread_count < 0
  )
    unreadable()
  if (
    value.last_message != null &&
    (!isMessageId(value.last_message.id) ||
      !isMessageId(value.last_message.sender_id) ||
      (value.last_message.content != null && typeof value.last_message.content !== 'string'))
  )
    unreadable()
  return { ...value, other_user: person(value.other_user) }
}
function message(value, conversationId) {
  if (
    !isMessageId(value?.id) ||
    value.conversation_id !== conversationId ||
    (value.content != null && typeof value.content !== 'string') ||
    typeof value.created_at !== 'string' ||
    !Number.isFinite(Date.parse(value.created_at)) ||
    (value.attachments != null && !Array.isArray(value.attachments))
  )
    unreadable()
  return { ...value, sender: person(value.sender), attachments: value.attachments || [] }
}
export async function getConversations({ skip = 0, limit = 20 } = {}, signal) {
  if (
    !Number.isSafeInteger(skip) ||
    skip < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error('Invalid conversation pagination.')
  const result = await apiRequest(
    '/messages/conversations?' + new URLSearchParams({ skip, limit }),
    { signal },
  )
  if (!Array.isArray(result) || result.length > limit) unreadable()
  return result.map(conversation)
}
export async function getConversation(conversationId, signal) {
  const target = id(conversationId)
  // There is no GET /conversations/:id endpoint. Resolve deep links from the member-only list.
  for (let skip = 0; ; skip += 100) {
    signal?.throwIfAborted()
    const page = await getConversations({ skip, limit: 100 }, signal)
    const found = page.find((item) => item.id === target)
    if (found) return found
    if (page.length < 100) throw new ApiError('Conversation not found.', 404)
  }
}
export async function openConversation(recipientId, signal) {
  return conversation(
    await apiRequest('/messages/conversations', {
      method: 'POST',
      body: { recipient_id: id(recipientId) },
      signal,
    }),
  )
}
export async function getMessages(conversationId, { before_id, limit = 50 } = {}, signal) {
  const target = id(conversationId)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid message pagination.')
  const params = new URLSearchParams({ limit })
  if (before_id != null) params.set('before_id', id(before_id))
  const result = await apiRequest(`/messages/conversations/${target}/messages?${params}`, {
    signal,
  })
  if (!Array.isArray(result?.items) || result.items.length > limit) unreadable()
  const items = result.items.map((value) => message(value, target))
  const cursor = result.next_before_id ?? null
  if (
    items.some((item) => before_id != null && item.id >= Number(before_id)) ||
    (cursor !== null &&
      (!isMessageId(cursor) || !items.length || cursor > Math.min(...items.map((item) => item.id))))
  )
    unreadable()
  return { items, next_before_id: cursor }
}
export async function sendMessage(conversationId, content, signal) {
  const target = id(conversationId)
  if (typeof content !== 'string' || !content.trim() || content.length > 4000)
    throw new Error('Enter a message between 1 and 4000 characters.')
  return message(
    await apiRequest(`/messages/conversations/${target}/messages`, {
      method: 'POST',
      body: { content: content.trim() },
      signal,
    }),
    target,
  )
}
export async function markConversationRead(conversationId, signal) {
  const result = await apiRequest(`/messages/conversations/${id(conversationId)}/read`, {
    method: 'POST',
    signal,
  })
  if (!Number.isSafeInteger(result?.marked_count) || result.marked_count < 0)
    throw new Error('Could not confirm read status. Please retry.')
  return result.marked_count
}
export function messageError(error) {
  if (error.status === 401) return 'Please sign in again to view your messages.'
  if (error.status === 403)
    return 'Messaging is unavailable. Only accepted friends with messaging access can send messages.'
  if (error.status === 404) return 'This conversation is unavailable or you no longer have access.'
  if (error.status === 429) return 'Too many messages. Please wait a moment before trying again.'
  return error instanceof TypeError
    ? 'Could not connect. Please try again.'
    : error.message || 'Could not load messages. Please try again.'
}
export function mergeMessages(previous, incoming) {
  const items = new Map(previous.map((item) => [item.id, item]))
  for (const item of incoming)
    items.set(item.id, { ...item, read_at: item.read_at || items.get(item.id)?.read_at || null })
  return [...items.values()].sort((a, b) => a.id - b.id)
}
export function messagePreview(message) {
  return (
    message?.content ||
    (message?.has_attachments || message?.attachments?.length
      ? 'Image attachment'
      : 'No messages yet')
  )
}
