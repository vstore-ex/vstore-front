import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context'
import { useNotifications } from '../../notifications/context'
import { messagePreview } from '../../api/messages'
import useInbox from '../../messages/useInbox'
import useConversation from '../../messages/useConversation'
import fallbackAvatar from '../../assets/avatar.webp'
import './MessagesPage.css'

function Avatar({ user }) {
  return (
    <img
      className="messages-avatar"
      src={user.avatar || fallbackAvatar}
      alt=""
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = 'true'
          event.currentTarget.src = fallbackAvatar
        }
      }}
    />
  )
}
function MessageTime({ value }) {
  if (!value) return null
  const utc = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + 'Z'
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? null : (
    <time dateTime={utc}>
      {date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </time>
  )
}
function ErrorNotice({ error, retry, label }) {
  return error ? (
    <div className="messages-error" role="alert">
      <p>{error}</p>
      {retry && (
        <button className="button button--secondary" type="button" onClick={retry}>
          {label}
        </button>
      )}
    </div>
  ) : null
}
function Conversation({ id, owner, draft, changeDraft, onInboxUpdate }) {
  const state = useConversation(id, owner, onInboxUpdate)
  const [notice, setNotice] = useState('')
  const heading = useRef(null)
  const viewport = useRef(null)
  const nearBottom = useRef(true)
  const newestId = state.items.at(-1)?.id
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (!nearBottom.current) return
    const frame = requestAnimationFrame(() => {
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [newestId])
  async function send(event) {
    event.preventDefault()
    setNotice('')
    if (await state.send(draft)) {
      changeDraft('')
      nearBottom.current = true
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
      setNotice('Message sent.')
    }
  }
  async function older() {
    const box = viewport.current
    const height = box?.scrollHeight || 0
    const top = box?.scrollTop || 0
    nearBottom.current = false
    await state.older()
    requestAnimationFrame(() => {
      if (box?.isConnected) box.scrollTop = top + box.scrollHeight - height
    })
  }
  const other = state.conversation?.other_user
  return (
    <section className="conversation" aria-labelledby="conversation-title">
      <a className="messages-back" href="#/messages">
        Back to conversations
      </a>
      <header className="conversation-heading">
        <h2 id="conversation-title" ref={heading} tabIndex={-1}>
          {other ? `Conversation with @${other.username}` : 'Conversation'}
        </h2>
        <button
          type="button"
          className="button button--secondary"
          disabled={state.loading}
          onClick={state.refresh}
        >
          Refresh messages
        </button>
      </header>
      {other && (
        <a className="conversation-person" href={'#/users/' + other.id}>
          <Avatar key={other.avatar} user={other} />
          <span>View @{other.username}'s profile</span>
        </a>
      )}
      {state.loading && (
        <p role="status" className={state.conversation ? 'messages-visually-hidden' : undefined}>
          Loading messages...
        </p>
      )}
      <ErrorNotice error={state.error} retry={state.refresh} label="Retry messages" />
      {state.conversation && (
        <>
          {state.cursor && (
            <button
              type="button"
              className="button button--secondary"
              disabled={state.olderLoading}
              onClick={older}
            >
              {state.olderLoading ? 'Loading older messages...' : 'Load older messages'}
            </button>
          )}
          <ErrorNotice error={state.olderError} />
          <div
            ref={viewport}
            className="conversation-history"
            tabIndex={0}
            aria-label="Scrollable message history"
            onScroll={(event) => {
              const box = event.currentTarget
              nearBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 60
            }}
          >
            {!state.items.length && !state.loading && (
              <p className="messages-empty">No messages yet. Say hello!</p>
            )}
            <ol
              className="conversation-messages"
              role="log"
              aria-label="Conversation messages"
              aria-live="polite"
              aria-relevant="additions"
              aria-busy={state.loading || state.olderLoading}
            >
              {state.items.map((item) => (
                <li
                  key={item.id}
                  className={
                    item.sender.id === owner
                      ? 'message-bubble message-bubble--own'
                      : 'message-bubble'
                  }
                >
                  <div className="message-byline">
                    <a href={'#/users/' + item.sender.id}>
                      {item.sender.id === owner ? 'You' : '@' + item.sender.username}
                    </a>
                    <MessageTime value={item.created_at} />
                  </div>
                  {item.content && <p>{item.content}</p>}
                  {!!item.attachments.length && (
                    <p className="message-attachment-note">
                      {item.attachments.length} image attachment(s). Image viewing will be available
                      in a future update.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className="conversation-history-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                nearBottom.current = true
                if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
              }}
            >
              Jump to latest
            </button>
            {state.reading && (
              <span role="status" className="messages-visually-hidden">
                Updating read status...
              </span>
            )}
          </div>
          <ErrorNotice error={state.readError} retry={state.markRead} label="Retry read status" />
          {!state.conversation.can_send && (
            <p role="status">
              This conversation is read-only. Messaging is available only to accepted friends with
              messaging access.
            </p>
          )}
        </>
      )}
      <form className="message-composer" onSubmit={send}>
        <label htmlFor="message-draft">Your message</label>
        <textarea
          id="message-draft"
          rows={4}
          maxLength={4000}
          value={draft}
          aria-describedby="message-length"
          disabled={state.sending || !state.conversation?.can_send}
          onChange={(event) => {
            changeDraft(event.target.value)
            setNotice('')
          }}
        />
        <div className="message-composer-actions">
          <span id="message-length">{draft.length} / 4000 characters</span>
          <button
            type="submit"
            className="button button--accent"
            disabled={
              state.sending ||
              state.loading ||
              !!state.error ||
              !state.conversation?.can_send ||
              !draft.trim() ||
              draft.length > 4000
            }
          >
            {state.sending ? 'Sending...' : 'Send message'}
          </button>
        </div>
        <ErrorNotice error={state.sendError} />
        {state.sendError && (
          <p>
            Your draft is preserved. Refresh the conversation before retrying if delivery is
            uncertain.
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </form>
    </section>
  )
}
function MessagesSession({ conversationId, owner }) {
  const inbox = useInbox()
  const { messageConnection } = useNotifications()
  const [drafts, setDrafts] = useState({})
  return (
    <div className="messages-page">
      <header className="messages-heading">
        <div>
          <h1>Messages</h1>
          <p>Private conversations with your friends.</p>
        </div>
        <p
          className={'messages-connection messages-connection--' + messageConnection}
          role="status"
        >
          {messageConnection === 'connected'
            ? 'Live updates connected'
            : messageConnection === 'connecting'
              ? 'Connecting to live updates...'
              : 'Live updates unavailable. Reconnecting when possible; you can refresh manually.'}
        </p>
      </header>
      <div className={'messages-layout' + (conversationId ? ' messages-layout--open' : '')}>
        <section className="messages-inbox" aria-labelledby="inbox-title">
          <div className="messages-inbox-heading">
            <h2 id="inbox-title">Conversations</h2>
            <button
              type="button"
              className="button button--secondary"
              disabled={inbox.loading}
              onClick={() => inbox.load()}
            >
              Refresh conversations
            </button>
          </div>
          {inbox.loading && (
            <p
              role="status"
              className={inbox.items.length ? 'messages-visually-hidden' : undefined}
            >
              Loading conversations...
            </p>
          )}
          <ErrorNotice
            error={inbox.error}
            retry={() => inbox.load(inbox.retryPage)}
            label="Retry conversations"
          />
          {!inbox.loading && !inbox.error && !inbox.items.length && (
            <p className="messages-empty">
              No conversations on this page. <a href="#/account">Open your friends list</a> to start
              a conversation.
            </p>
          )}
          <ul className="conversation-list" aria-label="Conversations" aria-busy={inbox.loading}>
            {inbox.items.map((item) => (
              <li key={item.id}>
                <a
                  className="conversation-link"
                  href={'#/messages/' + item.id}
                  aria-current={Number(conversationId) === item.id ? 'page' : undefined}
                >
                  <Avatar key={item.other_user.avatar} user={item.other_user} />
                  <div>
                    <strong>@{item.other_user.username}</strong>
                    {item.other_user.full_name && <small>{item.other_user.full_name}</small>}
                    <p>{messagePreview(item.last_message)}</p>
                    <MessageTime value={item.last_message?.created_at} />
                  </div>
                  {item.unread_count > 0 && (
                    <span
                      className="conversation-unread"
                      aria-label={item.unread_count + ' unread messages'}
                    >
                      {item.unread_count}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          <nav className="messages-pagination" aria-label="Conversation pages">
            <button
              type="button"
              className="button button--secondary"
              disabled={inbox.loading || inbox.page === 0}
              onClick={() => inbox.load(inbox.page - 1)}
            >
              Previous
            </button>
            <span>Page {inbox.page + 1}</span>
            <button
              type="button"
              className="button button--secondary"
              disabled={inbox.loading || !inbox.more}
              onClick={() => inbox.load(inbox.page + 1)}
            >
              Next
            </button>
          </nav>
        </section>
        {conversationId ? (
          <Conversation
            key={conversationId}
            id={conversationId}
            owner={owner}
            draft={drafts[conversationId] || ''}
            changeDraft={(value) => setDrafts((old) => ({ ...old, [conversationId]: value }))}
            onInboxUpdate={inbox.load}
          />
        ) : (
          <section className="messages-placeholder">
            <h2>Choose a conversation</h2>
            <p>Open a conversation from the list, or use Message on a friend's profile.</p>
            <a className="button button--secondary" href="#/account">
              Find a friend
            </a>
          </section>
        )}
      </div>
    </div>
  )
}
export default function MessagesPage({ conversationId }) {
  const { currentUser, isAuthenticated, isLoggingOut } = useAuth()
  return isAuthenticated && currentUser?.id && !isLoggingOut ? (
    <MessagesSession key={currentUser.id} owner={currentUser.id} conversationId={conversationId} />
  ) : (
    <p className="store-status">Please sign in to view your messages.</p>
  )
}
