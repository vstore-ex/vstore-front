import { useEffect, useId, useRef, useState } from 'react'
import { notificationDestination } from '../api/notifications'
import { messageSoundEnabled, setMessageSoundEnabled, playMessageSound } from './messageSound'
import { useNotifications } from './context'
import NotificationIcon from './NotificationIcon'
import { fullTime, relativeTime } from './format'
import './Notifications.css'

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    countError,
    busy,
    desktopPermission,
    refresh,
    markAsRead,
    requestDesktopPermission,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(messageSoundEnabled)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const panelId = useId()
  const root = useRef(null)
  const toggle = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    // Close the menu when the route changes, e.g. after following a notification.
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  function togglePanel() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void refresh()
  }

  function handleKeyDown(event) {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    toggle.current?.focus()
  }

  return (
    <div className="notification-center" ref={root} onKeyDown={handleKeyDown}>
      <button
        ref={toggle}
        className="icon-button notification-button"
        type="button"
        aria-label={
          countError
            ? 'Notifications, unread count unavailable'
            : unreadCount === null
              ? 'Notifications, loading unread count'
              : `Notifications, ${unreadCount} unread`
        }
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={togglePanel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {(unreadCount > 0 || unreadCount === null || countError) && (
          <span className="cart-count notification-count" aria-live="polite">
            {countError ? '!' : unreadCount === null ? '…' : unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-panel"
          id={panelId}
          role="dialog"
          aria-label="Notifications"
        >
          <header className="notification-panel__header">
            <h2>
              Notifications
              {unreadCount > 0 && <span className="notification-panel__count">{unreadCount}</span>}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-text-button"
                disabled={loading || busy || !!error}
                onClick={() => void markAsRead(null)}
              >
                Mark all as read
              </button>
            )}
          </header>
          {error && (
            <div className="notification-error" role="alert">
              <p>{error}</p>
              <button type="button" disabled={loading || busy} onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          <div className="notification-panel__body">
            {loading && !notifications.length ? (
              <p className="notification-empty" role="status">
                Loading notifications...
              </p>
            ) : notifications.length ? (
              <ul className="notification-list">
                {notifications.map((notification) => {
                  const destination = notificationDestination(notification)
                  const unread = !notification.is_read
                  const content = (
                    <>
                      <NotificationIcon type={notification.type} />
                      <span className="notification-item__copy">
                        <strong>{notification.title}</strong>
                        {notification.message && <span>{notification.message}</span>}
                        <time
                          dateTime={notification.created_at}
                          title={fullTime(notification.created_at)}
                        >
                          {relativeTime(notification.created_at)}
                        </time>
                      </span>
                    </>
                  )
                  return (
                    <li
                      className={`notification-item${unread ? ' notification-item--unread' : ''}`}
                      key={notification.id}
                    >
                      {destination ? (
                        <a
                          className="notification-item__main"
                          href={destination.href}
                          onClick={() => {
                            if (unread && !busy && !error) void markAsRead([notification.id])
                            setOpen(false)
                          }}
                        >
                          {content}
                        </a>
                      ) : (
                        <div className="notification-item__main">{content}</div>
                      )}
                      {unread && (
                        <button
                          type="button"
                          className="notification-read-button"
                          disabled={loading || busy || !!error}
                          aria-label={`Mark ${notification.title} as read`}
                          title="Mark as read"
                          onClick={() => void markAsRead([notification.id])}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              !error && (
                <div className="notification-empty">
                  <NotificationIcon type="" />
                  <p>You're all caught up.</p>
                </div>
              )
            )}
          </div>
          {settingsOpen && (
            <div className="notification-settings" aria-label="Notification settings" role="group">
              {desktopPermission === 'default' && (
                <button
                  type="button"
                  className="notification-desktop-toggle"
                  onClick={() => void requestDesktopPermission()}
                >
                  Enable desktop notifications
                </button>
              )}
              {desktopPermission === 'denied' && (
                <p className="notification-hint">
                  Desktop notifications are blocked in browser settings.
                </p>
              )}
              {desktopPermission === 'granted' && (
                <p className="notification-hint">Desktop notifications are on.</p>
              )}
              <button
                type="button"
                className="notification-desktop-toggle"
                aria-pressed={soundOn}
                onClick={() => {
                  const next = !soundOn
                  setMessageSoundEnabled(next)
                  setSoundOn(next)
                  if (next) playMessageSound()
                }}
              >
                {soundOn ? 'Disable message sound' : 'Enable message sound'}
              </button>
            </div>
          )}
          <footer className="notification-panel__footer">
            <a
              className="notification-view-all"
              href="#/notifications"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </a>
            <button
              type="button"
              className="notification-settings-toggle"
              aria-expanded={settingsOpen}
              aria-label="Notification settings"
              title="Notification settings"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
