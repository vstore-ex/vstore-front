import { createContext, useContext } from 'react'

const noop = () => {}

export const EMPTY_NOTIFICATIONS = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: '',
  toast: null,
  desktopPermission: 'unsupported',
  refresh: noop,
  markAsRead: async () => {},
  requestDesktopPermission: async () => 'unsupported',
  dismissToast: noop,
}

export const NotificationsContext = createContext(EMPTY_NOTIFICATIONS)

export function useNotifications() {
  return useContext(NotificationsContext)
}
