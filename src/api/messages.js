import { apiRequest, ApiError, mediaUrl } from './client'

export const isMessageId = (value) => Number.isSafeInteger(value) && value > 0
export const MAX_MESSAGE_IMAGES = 5
export const MAX_MESSAGE_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_MESSAGE_IMAGES_BYTES = 15 * 1024 * 1024
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
function attachment(value, conversationId) {
  const expectedUrl = `/api/v1/messages/conversations/${conversationId}/attachments/${value?.id}`
  if (
    !isMessageId(value?.id) ||
    !MESSAGE_MEDIA_TYPES.has(value.content_type) ||
    !Number.isSafeInteger(value.size_bytes) ||
    value.size_bytes <= 0 ||
    value.download_url !== expectedUrl
  )
    unreadable()
  return value
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
    (value.edited_at != null && typeof value.edited_at !== 'string') ||
    (value.deleted_at != null && typeof value.deleted_at !== 'string') ||
    (value.attachments != null &&
      (!Array.isArray(value.attachments) || value.attachments.length > MAX_MESSAGE_IMAGES))
  )
    unreadable()
  return {
    ...value,
    sender: person(value.sender),
    attachments: (value.attachments || []).map((item) => attachment(item, conversationId)),
  }
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
export function messageFilesError(files) {
  if (!files.length) return ''
  if (files.length > MAX_MESSAGE_IMAGES) return 'Attach up to 5 images.'
  if (files.some((file) => !file.type?.startsWith('image/')))
    return 'Only image files can be attached.'
  if (files.some((file) => !file.size)) return 'Images cannot be empty.'
  if (files.some((file) => file.size > MAX_MESSAGE_IMAGE_BYTES))
    return 'Each image must be 5 MiB or smaller.'
  if (files.reduce((total, file) => total + file.size, 0) > MAX_MESSAGE_IMAGES_BYTES)
    return 'All images together must be 15 MiB or smaller.'
  return ''
}
export async function sendMessage(conversationId, content, signal, files = []) {
  const target = id(conversationId)
  const text = typeof content === 'string' ? content.trim() : ''
  const uploads = Array.from(files || [])
  const filesError = messageFilesError(uploads)
  if (filesError) throw new Error(filesError)
  if ((!text && !uploads.length) || (typeof content === 'string' && content.length > 4000))
    throw new Error('Enter a message between 1 and 4000 characters.')
  let body = { content: text }
  if (uploads.length) {
    body = new FormData()
    if (text) body.append('content', text)
    for (const file of uploads) body.append('files', file, file.name)
  }
  return message(
    await apiRequest(`/messages/conversations/${target}/messages`, {
      method: 'POST',
      body,
      signal,
    }),
    target,
  )
}
export async function getMessage(conversationId, messageId, signal) {
  const target = id(conversationId)
  return message(
    await apiRequest(`/messages/conversations/${target}/messages/${id(messageId)}`, { signal }),
    target,
  )
}
export async function editMessage(conversationId, messageId, content, signal) {
  const target = id(conversationId)
  const current = id(messageId)
  if (typeof content !== 'string' || !content.trim() || content.length > 4000)
    throw new Error('Enter a message between 1 and 4000 characters.')
  return message(
    await apiRequest(`/messages/conversations/${target}/messages/${current}`, {
      method: 'PATCH',
      body: { content },
      signal,
    }),
    target,
  )
}
export async function deleteMessage(conversationId, messageId, signal) {
  const target = id(conversationId)
  return message(
    await apiRequest(`/messages/conversations/${target}/messages/${id(messageId)}`, {
      method: 'DELETE',
      signal,
    }),
    target,
  )
}
export const MESSAGE_MEDIA_TYPES = new Set(['image/webp', 'video/mp4', 'video/webm'])

export async function getMessageAttachment(conversationId, item, signal) {
  const target = id(conversationId)
  const attachmentId = id(item?.id)
  const expectedUrl = `/api/v1/messages/conversations/${target}/attachments/${attachmentId}`
  if (item?.download_url !== expectedUrl || !MESSAGE_MEDIA_TYPES.has(item?.content_type))
    unreadable()
  const blob = await apiRequest(`/messages/conversations/${target}/attachments/${attachmentId}`, {
    signal,
    responseType: 'blob',
  })
  if (!blob || blob.type !== item?.content_type) unreadable()
  return blob
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
  return message?.deleted_at
    ? 'Message deleted'
    : message?.content ||
        (message?.has_attachments || message?.attachments?.length
          ? 'Attachment'
          : 'No messages yet')
}
