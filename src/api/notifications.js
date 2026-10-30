import { apiRequest } from './client'

export function getNotifications(options = {}) {
  return apiRequest('/notifications?limit=20', options)
}

export function markNotificationsRead(notificationIds) {
  return apiRequest('/notifications/read', {
    method: 'POST',
    body: notificationIds?.length ? { notification_ids: notificationIds } : undefined,
  })
}
