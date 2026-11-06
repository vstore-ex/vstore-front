import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context'
import { notificationDestination } from '../../api/notifications'
import { useNotifications } from '../../notifications/context'
import NotificationIcon from '../../notifications/NotificationIcon'
import { dayGroup, fullTime, relativeTime } from '../../notifications/format'
import '../../notifications/Notifications.css'

function NotificationList() {
  const state = useNotifications()
  const { list, load, busy } = state
  const [selected, setSelected] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    load(undefined, controller.signal)
    return () => controller.abort()
  }, [load])
  const { data, query } = list
  const selection = selected.filter((id) =>
    data?.items.some((item) => item.id === id && !item.is_read),
  )
  const total = data ? (query.unread_only ? data.unread_count : data.total) : 0
  const pages = Math.max(1, Math.ceil(total / query.limit))
  const page = Math.floor(query.offset / query.limit) + 1
  const disabled = list.loading || busy
  async function change(next) {
    if (await load(next)) setSelected([])
  }
  async function mark(ids) {
    if (await state.markAsRead(ids)) setSelected([])
  }
  const groups = []
  for (const item of data?.items || []) {
    const label = dayGroup(item.created_at)
    const group = groups.find((entry) => entry.label === label)
    if (group) group.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <header className="notifications-heading">
        <div>
          <h1 id="notifications-title">Notifications</h1>
          <p>
            {data
              ? `${data.unread_count.toLocaleString()} unread · ${data.total.toLocaleString()} total`
              : 'Your updates and activity.'}
          </p>
        </div>
        <button
          className="button button--secondary"
          disabled={disabled}
          onClick={() => change(query)}
        >
          Refresh notifications
        </button>
      </header>
      <div className="notifications-toolbar">
        <label className="notifications-switch">
          <input
            type="checkbox"
            checked={list.loading ? list.retryQuery.unread_only : query.unread_only}
            disabled={disabled}
            onChange={(event) => change({ ...query, offset: 0, unread_only: event.target.checked })}
          />
          <span className="notifications-switch__track" aria-hidden="true" />
          Unread only
        </label>
        <div className="notifications-toolbar__actions">
          {selection.length > 0 && (
            <span className="notifications-selection">{selection.length} selected</span>
          )}
          <button
            className="button button--secondary"
            disabled={disabled || !selection.length || !!list.error}
            onClick={() => mark(selection)}
          >
            Mark selected as read
          </button>
          <button
            className="button button--secondary"
            disabled={disabled || !data?.unread_count || !!list.error}
            onClick={() => mark(null)}
          >
            Mark all as read
          </button>
        </div>
      </div>
      {state.actionError && (
        <p className="notifications-error" role="alert">
          {state.actionError} Retry the action or refresh notifications.
        </p>
      )}
      {state.message && (
        <p className="notifications-message" role="status">
          {state.message}
        </p>
      )}
      {disabled && (
        <p className="notifications-loading" role="status">
          {busy ? 'Updating notifications…' : 'Loading notifications…'}
        </p>
      )}
      {list.error && (
        <div className="notifications-error" role="alert">
          <p>{list.error}</p>
          {data && <p>Showing previously loaded notifications.</p>}
          <button
            className="button button--secondary"
            disabled={disabled}
            onClick={() => change(list.retryQuery)}
          >
            Retry notifications
          </button>
        </div>
      )}
      {data && !data.items.length && !list.error && (
        <div className="notifications-empty">
          <NotificationIcon type="" />
          <p>{query.unread_only ? 'No unread notifications.' : 'No notifications yet.'}</p>
        </div>
      )}
      {data && !!data.items.length && (
        <div className="notifications-groups" aria-busy={disabled}>
          {groups.map((group) => (
            <section key={group.label} className="notifications-group" aria-label={group.label}>
              <h2 className="notifications-group__title">{group.label}</h2>
              <ul className="notifications-list" aria-label={`${group.label} notifications`}>
                {group.items.map((item) => {
                  const destination = notificationDestination(item)
                  const messageDestination = item.type === 'new_message' ? destination : null
                  const unread = !item.is_read
                  return (
                    <li
                      key={item.id}
                      className={'notification-card' + (unread ? ' notification-card--unread' : '')}
                    >
                      <div className="notification-card__select">
                        {unread && (
                          <input
                            type="checkbox"
                            aria-label={'Select ' + item.title}
                            checked={selection.includes(item.id)}
                            disabled={disabled || !!list.error}
                            onChange={(event) =>
                              setSelected((previous) =>
                                event.target.checked
                                  ? [...previous, item.id]
                                  : previous.filter((id) => id !== item.id),
                              )
                            }
                          />
                        )}
                      </div>
                      <NotificationIcon type={item.type} />
                      <div className="notification-body">
                        {/* Messages open the conversation from the whole card; others get a link. */}
                        {messageDestination ? (
                          <a className="notification-main-link" href={messageDestination.href}>
                            <h3>{item.title}</h3>
                            {item.message && <p>{item.message}</p>}
                            <span className="notification-link">{messageDestination.label}</span>
                          </a>
                        ) : (
                          <>
                            <h3>{item.title}</h3>
                            {item.message && <p>{item.message}</p>}
                          </>
                        )}
                        <div className="notification-meta">
                          <span
                            className={
                              'notification-status' + (unread ? ' notification-status--unread' : '')
                            }
                          >
                            {unread ? 'Unread' : 'Read'}
                          </span>
                          <time dateTime={item.created_at} title={fullTime(item.created_at)}>
                            {relativeTime(item.created_at)}
                          </time>
                          {destination && !messageDestination && (
                            <a className="notification-link" href={destination.href}>
                              {destination.label}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="notification-actions">
                        <button
                          type="button"
                          className="notification-action notification-action--delete"
                          aria-label={'Delete ' + item.title}
                          title="Delete"
                          disabled={disabled || !!list.error}
                          onClick={() => state.remove(item.id)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {data && total > 0 && (
        <nav className="notifications-pagination" aria-label="Notification pages">
          <button
            className="button button--secondary"
            disabled={disabled || !!list.error || page <= 1}
            onClick={() => change({ ...query, offset: Math.max(0, query.offset - query.limit) })}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            className="button button--secondary"
            disabled={disabled || !!list.error || page >= pages}
            onClick={() => change({ ...query, offset: query.offset + query.limit })}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  )
}

export default function NotificationsPage() {
  const { currentUser, isAuthenticated } = useAuth()
  return isAuthenticated && currentUser?.id ? (
    <NotificationList key={currentUser.id} />
  ) : (
    <p className="store-status">Please sign in to view your notifications.</p>
  )
}
