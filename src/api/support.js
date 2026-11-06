import { apiRequest } from './client'

const priorities = new Set(['low', 'medium', 'high'])
const statuses = new Set(['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'])

function positiveId(value) {
  return Number.isSafeInteger(value) && value > 0
}

function unreadable() {
  throw new Error('Could not read support data. Please refresh.')
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function article(value) {
  if (
    !positiveId(value?.id) ||
    typeof value.title !== 'string' ||
    typeof value.content_md !== 'string' ||
    (value.category != null && typeof value.category !== 'string') ||
    !validDate(value.created_at) ||
    !validDate(value.updated_at)
  )
    unreadable()
  return value
}

function ticket(value, ownerId) {
  if (
    !positiveId(value?.id) ||
    !positiveId(value.user_id) ||
    value.user_id !== ownerId ||
    typeof value.subject !== 'string' ||
    !value.subject.trim() ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    !statuses.has(value.status) ||
    !priorities.has(value.priority) ||
    !Number.isSafeInteger(value.message_count) ||
    value.message_count < 1 ||
    !validDate(value.created_at) ||
    !validDate(value.updated_at) ||
    !validDate(value.last_message_at) ||
    (value.assigned_admin_id != null && !positiveId(value.assigned_admin_id)) ||
    (value.assigned_admin_username != null && typeof value.assigned_admin_username !== 'string')
  )
    unreadable()
  return value
}

function ticketId(value) {
  if (!positiveId(Number(value))) throw new Error('Invalid support request ID.')
  return Number(value)
}

function ticketMessage(value, id) {
  if (
    !positiveId(value?.id) ||
    value.ticket_id !== id ||
    !positiveId(value.sender_id) ||
    typeof value.sender_username !== 'string' ||
    !['customer', 'staff'].includes(value.sender_role) ||
    typeof value.body !== 'string' ||
    !value.body.trim() ||
    !validDate(value.created_at)
  )
    unreadable()
  return value
}

function ticketEvent(value, id) {
  if (
    !positiveId(value?.id) ||
    value.ticket_id !== id ||
    !['status_changed', 'priority_changed', 'assignment_changed'].includes(value.event_type) ||
    (value.actor_id != null && !positiveId(value.actor_id)) ||
    (value.actor_username != null && typeof value.actor_username !== 'string') ||
    (value.old_value != null && typeof value.old_value !== 'string') ||
    (value.new_value != null && typeof value.new_value !== 'string') ||
    !validDate(value.created_at)
  )
    unreadable()
  return value
}

export async function getSupportArticles({ page = 1, pageSize = 8, q = '' } = {}, signal) {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid support article page.')
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new Error('Invalid support article page size.')
  if (typeof q !== 'string' || q.trim().length > 200)
    throw new Error('Search must be 200 characters or fewer.')

  const params = new URLSearchParams({ page, page_size: pageSize })
  if (q.trim()) params.set('q', q.trim())
  const result = await apiRequest(`/articles?${params}`, {
    signal,
    auth: false,
    credentials: 'omit',
  })
  const totalPages = Math.ceil(result?.total / pageSize)
  if (
    !Array.isArray(result?.items) ||
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    result.page !== page ||
    result.page_size !== pageSize ||
    result.total_pages !== totalPages ||
    result.items.length > pageSize
  )
    unreadable()
  const items = result.items.map(article)
  if (new Set(items.map((item) => item.id)).size !== items.length) unreadable()
  return { items, total: result.total, page, page_size: pageSize, total_pages: totalPages }
}

export async function getMySupportTickets(ownerId, signal) {
  if (!positiveId(ownerId)) throw new Error('Invalid support account.')
  const result = await apiRequest('/me/tickets', { signal })
  if (!Array.isArray(result)) unreadable()
  const tickets = result.map((item) => ticket(item, ownerId))
  if (new Set(tickets.map((item) => item.id)).size !== tickets.length) unreadable()
  return tickets
}

export async function createSupportTicket(
  { subject, message, priority = 'medium' },
  ownerId,
  signal,
) {
  if (!positiveId(ownerId)) throw new Error('Invalid support account.')
  const title = typeof subject === 'string' ? subject.trim() : ''
  const details = typeof message === 'string' ? message.trim() : ''
  if (!title || title.length > 255) throw new Error('Subject must contain 1–255 characters.')
  if (!details || details.length > 10000)
    throw new Error('Message must contain 1–10000 characters.')
  if (!priorities.has(priority)) throw new Error('Choose a valid support priority.')

  return ticket(
    await apiRequest('/tickets', {
      method: 'POST',
      body: { subject: title, message: details, priority },
      signal,
    }),
    ownerId,
  )
}

export async function getSupportTicketMessages(id, signal) {
  const target = ticketId(id)
  const result = await apiRequest(`/tickets/${target}/messages`, { signal })
  if (!Array.isArray(result)) unreadable()
  const messages = result.map((item) => ticketMessage(item, target))
  if (new Set(messages.map((item) => item.id)).size !== messages.length) unreadable()
  return messages
}

export async function getSupportTicketDetails(id, ownerId, signal) {
  const target = ticketId(id)
  if (!positiveId(ownerId)) throw new Error('Invalid support account.')
  const result = await apiRequest(`/tickets/${target}`, { signal })
  const summary = ticket(result, ownerId)
  if (!Array.isArray(result.messages) || !Array.isArray(result.events)) unreadable()
  const messages = result.messages.map((item) => ticketMessage(item, target))
  const events = result.events.map((item) => ticketEvent(item, target))
  if (
    messages.length !== summary.message_count ||
    new Set(messages.map((item) => item.id)).size !== messages.length ||
    new Set(events.map((item) => item.id)).size !== events.length
  )
    unreadable()
  return { ...summary, messages, events }
}

export async function sendSupportTicketMessage(id, body, signal) {
  const target = ticketId(id)
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text || text.length > 10000) throw new Error('Message must contain 1–10000 characters.')
  return ticketMessage(
    await apiRequest(`/tickets/${target}/messages`, {
      method: 'POST',
      body: { body: text },
      signal,
    }),
    target,
  )
}

export function supportError(error) {
  if (error.status === 401) return 'Please sign in again to manage support requests.'
  if (error.status === 403) return 'You are not allowed to access these support requests.'
  if (error.status === 404) return 'This support request is no longer available.'
  if (error.status === 409) return 'This support request is closed and cannot receive replies.'
  return error instanceof TypeError
    ? 'Could not connect to support. Please try again.'
    : error.message || 'Could not load support. Please try again.'
}

export async function getSupportArticle(id, signal) {
  if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id)))
    throw new Error('Invalid help article ID.')
  return article(
    await apiRequest('/articles/' + encodeURIComponent(id), {
      signal,
      auth: false,
      credentials: 'omit',
    }),
  )
}
