import { createContext, useContext } from 'react'

const noop = () => {}

export const EMPTY_NOTIFICATIONS = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: '',
  toast: null,
  toasts: [],
  desktopPermission: 'unsupported',
  refresh: noop,
  markAsRead: async () => {},
  requestDesktopPermission: async () => 'unsupported',
  dismissToast: noop,
  dismissMessageToastsFrom: noop,
  clearMessageNotificationsFrom: async () => 0,
  subscribeMessages: () => noop,
  messageConnection: 'unavailable',
}

export const NotificationsContext = createContext(EMPTY_NOTIFICATIONS)

export function useNotifications() {
  return useContext(NotificationsContext)
}
