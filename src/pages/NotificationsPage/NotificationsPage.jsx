import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/context'
import { notificationDestination } from '../../api/notifications'
import { useNotifications } from '../../notifications/context'
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
  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <div className="notifications-heading">
        <div>
          <h1 id="notifications-title">Notifications</h1>
          <p>Your updates and activity.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={disabled}
          onClick={() => change(query)}
        >
          Refresh notifications
        </button>
      </div>
      <div className="notifications-toolbar">
        <label>
          <input
            type="checkbox"
            checked={list.loading ? list.retryQuery.unread_only : query.unread_only}
            disabled={disabled}
            onChange={(event) => change({ ...query, offset: 0, unread_only: event.target.checked })}
          />
          Unread only
        </label>
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
      {state.actionError && (
        <p className="notifications-error" role="alert">
          {state.actionError} Retry the action or refresh notifications.
        </p>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {disabled && (
        <p role="status">{busy ? 'Updating notifications…' : 'Loading notifications…'}</p>
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
        <p className="notifications-empty">
          {query.unread_only ? 'No unread notifications.' : 'No notifications yet.'}
        </p>
      )}
      {data && (
        <ul className="notifications-list" aria-label="Notifications" aria-busy={disabled}>
          {data.items.map((item) => {
            const destination = notificationDestination(item)
            const messageDestination = item.type === 'new_message' ? destination : null
            return (
              <li
                key={item.id}
                className={'notification-card' + (item.is_read ? '' : ' notification-card--unread')}
              >
                <div className="notification-body">
                  <span className="notification-status">{item.is_read ? 'Read' : 'Unread'}</span>
                  {messageDestination ? (
                    <a className="notification-message-link" href={messageDestination.href}>
                      <h2>{item.title}</h2>
                      <p>{item.message}</p>
                      <span>{messageDestination.label}</span>
                    </a>
                  ) : (
                    <>
                      <h2>{item.title}</h2>
                      <p>{item.message}</p>
                    </>
                  )}
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                  {destination && !messageDestination && (
                    <a href={destination.href}>{destination.label}</a>
                  )}
                </div>
                <div className="notification-actions">
                  {!item.is_read && (
                    <label>
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
                      Select
                    </label>
                  )}
                  <button
                    className="button button--secondary"
                    aria-label={'Delete ' + item.title}
                    disabled={disabled || !!list.error}
                    onClick={() => state.remove(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
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
