import { apiRequest } from './client'

const isCount = (value) => Number.isSafeInteger(value) && value >= 0
const isId = (value) => typeof value === 'string' && !!value.trim() && value.length <= 128

function notification(item) {
  if (
    !isId(item?.id) ||
    !Number.isSafeInteger(item.user_id) ||
    item.user_id < 1 ||
    typeof item.title !== 'string' ||
    typeof item.message !== 'string' ||
    typeof item.is_read !== 'boolean' ||
    typeof item.created_at !== 'string' ||
    !Number.isFinite(Date.parse(item.created_at))
  )
    throw new Error('Could not read notification details. Please refresh.')
  return {
    id: item.id,
    user_id: item.user_id,
    title: item.title,
    message: item.message,
    type: typeof item.type === 'string' ? item.type : '',
    is_read: item.is_read,
    created_at: item.created_at,
    data: item.data && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : {},
  }
}

export async function getNotifications(
  { limit = 20, offset = 0, unread_only = false } = {},
  signal,
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !isCount(offset) ||
    typeof unread_only !== 'boolean'
  )
    throw new Error('Invalid notification pagination.')
  const result = await apiRequest(
    '/notifications?' + new URLSearchParams({ limit, offset, unread_only }),
    { signal },
  )
  if (
    !Array.isArray(result?.items) ||
    !isCount(result.total) ||
    !isCount(result.unread_count) ||
    result.unread_count > result.total ||
    result.items.length > limit ||
    result.items.length > result.total
  )
    throw new Error('Could not read notifications. Please refresh.')
  const items = result.items.map(notification)
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    (unread_only && items.some((item) => item.is_read))
  )
    throw new Error('Could not read notifications. Please refresh.')
  return { items, total: result.total, unread_count: result.unread_count }
}

export async function getUnreadCount(signal) {
  const result = await apiRequest('/notifications/unread-count', { signal })
  if (!isCount(result?.unread_count)) throw new Error('Could not read the unread count.')
  return result.unread_count
}

export async function markNotificationsRead(ids, signal) {
  // The backend treats [] and missing IDs as ALL. Only explicit null may mark all.
  if (ids !== null && (!Array.isArray(ids) || !ids.length || !ids.every(isId)))
    throw new Error('Select at least one notification.')
  const result = await apiRequest('/notifications/read', {
    method: 'POST',
    body: { notification_ids: ids === null ? null : [...new Set(ids)] },
    signal,
  })
  if (!isCount(result?.marked_count))
    throw new Error('Could not confirm the update. Please refresh.')
  return result.marked_count
}

export async function markMessageNotificationsReadFromSender(senderId, signal) {
  if (!Number.isSafeInteger(senderId) || senderId < 1)
    throw new Error('Invalid message notification sender ID.')

  const ids = []
  const limit = 100
  const firstPage = await getNotifications({ limit, offset: 0 }, signal)
  const total = firstPage.total
  for (let offset = 0; offset < total; offset += limit) {
    const page = offset === 0 ? firstPage : await getNotifications({ limit, offset }, signal)
    ids.push(
      ...page.items
        .filter(
          (item) =>
            !item.is_read && item.type === 'new_message' && item.data.sender_id === senderId,
        )
        .map((item) => item.id),
    )
    if (page.items.length < limit) break
  }

  return ids.length ? markNotificationsRead(ids, signal) : 0
}

export function deleteNotification(id, signal) {
  if (!isId(id)) throw new Error('Invalid notification ID.')
  return apiRequest('/notifications/' + encodeURIComponent(id), { method: 'DELETE', signal })
}

export function notificationDestination(item) {
  const data = item.data || {}
  if (
    item.type === 'new_message' &&
    Number.isSafeInteger(data.conversation_id) &&
    data.conversation_id > 0
  )
    return { href: '#/messages/' + data.conversation_id, label: 'Open conversation' }
  if (
    [
      'support_ticket_assigned',
      'support_ticket_created',
      'support_ticket_message',
      'support_ticket_reply',
      'support_ticket_status_changed',
    ].includes(item.type) &&
    Number.isSafeInteger(data.ticket_id) &&
    data.ticket_id > 0
  )
    return { href: '#/support?request=' + data.ticket_id, label: 'Open support request' }
  const userId =
    item.type === 'friend_request'
      ? data.sender_id
      : item.type === 'friend_accepted'
        ? data.friend_id
        : data.user_id
  if (Number.isSafeInteger(userId) && userId > 0)
    return { href: '#/users/' + userId, label: 'View profile' }
  if (typeof data.game_id === 'string' && /^[a-zA-Z0-9_-]+$/.test(data.game_id))
    return { href: '#/games/' + data.game_id, label: 'View game' }
  if (Number.isSafeInteger(data.news_id) && data.news_id > 0)
    return { href: '#/news/' + data.news_id, label: 'Read news' }
  return null
}

export function notificationError(error) {
  if (error.status === 401) return 'Please sign in again to view your notifications.'
  if (error.status === 403)
    return 'Notifications are unavailable for this account. Please refresh or sign in again.'
  if (error.status === 404) return 'This notification is no longer available. Please refresh.'
  return error instanceof TypeError
    ? 'Could not connect. Please try again.'
    : error.message || 'Could not update notifications. Please try again.'
}
