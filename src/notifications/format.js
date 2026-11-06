// Shared presentation helpers for the notification menu and page.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", or a short date. */
export function relativeTime(value, now = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = now - date.getTime()
  if (diff < MINUTE) return 'Just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / DAY)
  if (days <= 0) return `${Math.floor(diff / HOUR)} h ago`
  if (days === 1) return 'Yesterday'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
}

export function fullTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** Day bucket used to group the notification page: Today, Yesterday or Earlier. */
export function dayGroup(value, now = Date.now()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(date)) / DAY)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier'
}

/** Visual category for a notification type. */
export function notificationKind(type) {
  if (type === 'new_message') return 'message'
  if (type?.startsWith('friend_')) return 'friend'
  if (type?.startsWith('support_')) return 'support'
  if (type?.includes('news')) return 'news'
  if (type?.includes('game') || type?.includes('order') || type?.includes('wishlist')) return 'game'
  return 'general'
}
