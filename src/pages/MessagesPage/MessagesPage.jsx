import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context'
import { useNotifications } from '../../notifications/context'
import {
  getMessageAttachment,
  messageError,
  messageFilesError,
  messagePreview,
} from '../../api/messages'
import useInbox from '../../messages/useInbox'
import useConversation from '../../messages/useConversation'
import fallbackAvatar from '../../assets/avatar.webp'
import './MessagesPage.css'

const MAX_LENGTH = 4000
const LENGTH_WARNING = 3800
const GROUP_GAP = 5 * 60 * 1000
const SEPARATOR_GAP = 15 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

let nextImageDraftId = 0

function Icon({ name }) {
  const paths = {
    back: <path d="M15 5l-7 7 7 7" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
        <path d="M20 20v-4h-4" />
      </>
    ),
    attach: (
      <path d="M20.5 11.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    ),
    send: (
      <>
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </>
    ),
    down: (
      <>
        <path d="M12 5v14" />
        <path d="M6 13l6 6 6-6" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </>
    ),
    bubble: (
      <path d="M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1 0-1.97-.13-2.87-.38L4.5 20.5l1.33-3.55C4.07 15.6 3 13.65 3 11.5 3 7.36 7.03 4 12 4z" />
    ),
  }
  return (
    <svg
      className="messages-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function parseDate(value) {
  if (!value) return null
  const utc = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + 'Z'
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? null : date
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}
function dayDistance(date) {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY)
}
const timeFormat = { hour: 'numeric', minute: '2-digit' }
function formatListTime(date) {
  const days = dayDistance(date)
  if (days <= 0) return date.toLocaleTimeString(undefined, timeFormat)
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, { dateStyle: 'short' })
}
function formatSeparator(date) {
  const days = dayDistance(date)
  const time = date.toLocaleTimeString(undefined, timeFormat)
  if (days <= 0) return `Today ${time}`
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${date.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...timeFormat,
  })
}
function fullTime(date) {
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
}

function Avatar({ user, size = 'md' }) {
  return (
    <img
      className={'messages-avatar messages-avatar--' + size}
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
function displayName(user) {
  return user.full_name?.trim() || '@' + user.username
}
function ErrorNotice({ error, retry, label, compact = false }) {
  return error ? (
    <div className={'messages-error' + (compact ? ' messages-error--compact' : '')} role="alert">
      <p>{error}</p>
      {retry && (
        <button className="messages-text-button" type="button" onClick={retry}>
          {label}
        </button>
      )}
    </div>
  ) : null
}
function MessageImage({ attachment, conversationId, index }) {
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let objectUrl = ''
    getMessageAttachment(conversationId, attachment, controller.signal)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      })
      .catch((reason) => {
        if (active && !controller.signal.aborted) setError(messageError(reason))
      })
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, attempt, conversationId])
  if (error)
    return (
      <div className="message-attachment-error" role="group" aria-label="Private image">
        <p role="alert">Could not load private image: {error}</p>
        <button
          type="button"
          className="messages-text-button"
          onClick={() => {
            setError('')
            setAttempt((value) => value + 1)
          }}
        >
          Retry image
        </button>
      </div>
    )
  return imageUrl ? (
    <a className="message-image-link" href={imageUrl} target="_blank" rel="noreferrer">
      <img className="message-image" src={imageUrl} alt={`Private message image ${index + 1}`} />
    </a>
  ) : (
    <div className="message-image-placeholder">
      <span className="messages-visually-hidden" role="status">
        Loading private image {index + 1}...
      </span>
    </div>
  )
}
function SelectedImage({ entry, remove, disabled }) {
  return (
    <li className="message-selected-image">
      <img src={entry.previewUrl} alt={`Preview of ${entry.file.name}`} />
      <button
        type="button"
        className="message-selected-remove"
        aria-label={`Remove ${entry.file.name}`}
        title={`Remove ${entry.file.name}`}
        disabled={disabled}
        onClick={remove}
      >
        <Icon name="close" />
      </button>
    </li>
  )
}

/** Splits the flat history into time-separated, per-sender bubble groups. */
function layoutMessages(items) {
  return items.map((item, index) => {
    const date = parseDate(item.created_at)
    const previous = items[index - 1]
    const next = items[index + 1]
    const previousDate = parseDate(previous?.created_at)
    const nextDate = parseDate(next?.created_at)
    const separator =
      !previous ||
      !date ||
      !previousDate ||
      startOfDay(date) !== startOfDay(previousDate) ||
      date - previousDate > SEPARATOR_GAP
    const nextSeparated =
      !next ||
      !date ||
      !nextDate ||
      startOfDay(date) !== startOfDay(nextDate) ||
      nextDate - date > SEPARATOR_GAP
    const first =
      separator || previous.sender.id !== item.sender.id || date - previousDate > GROUP_GAP
    const last = nextSeparated || next.sender.id !== item.sender.id || nextDate - date > GROUP_GAP
    return { item, date, separator, first, last }
  })
}

function Conversation({
  id,
  owner,
  preview,
  draft,
  files,
  changeDraft,
  changeFiles,
  onInboxUpdate,
}) {
  const state = useConversation(id, owner, onInboxUpdate)
  const [notice, setNotice] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [dragging, setDragging] = useState(false)
  const heading = useRef(null)
  const viewport = useRef(null)
  const textarea = useRef(null)
  const messageList = useRef(null)
  const nearBottom = useRef(true)
  const dragDepth = useRef(0)
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
  const hasConversation = !!state.conversation
  useEffect(() => {
    // Late-loading images grow the history; keep the latest message in view if it was.
    const list = messageList.current
    if (!hasConversation || !list || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (nearBottom.current && viewport.current)
        viewport.current.scrollTop = viewport.current.scrollHeight
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [hasConversation])
  useLayoutEffect(() => {
    const box = textarea.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = Math.min(box.scrollHeight, 168) + 'px'
  }, [draft])
  function scrollToLatest(behavior = 'auto') {
    nearBottom.current = true
    setAtBottom(true)
    const box = viewport.current
    if (!box) return
    if (behavior === 'smooth' && typeof box.scrollTo === 'function')
      box.scrollTo({ top: box.scrollHeight, behavior })
    else box.scrollTop = box.scrollHeight
  }
  async function send() {
    setNotice('')
    if (
      await state.send(
        draft,
        files.map((entry) => entry.file),
      )
    ) {
      changeDraft('')
      changeFiles([])
      scrollToLatest()
      setNotice('Message sent.')
      textarea.current?.focus()
    }
  }
  function addFiles(selected) {
    const nextFiles = [...files.map((entry) => entry.file), ...selected]
    const error = messageFilesError(nextFiles)
    if (error) {
      setAttachmentError(error)
      return
    }
    changeFiles([
      ...files,
      ...selected.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        key: ++nextImageDraftId,
      })),
    ])
    setAttachmentError('')
  }
  const canWrite = !!state.conversation?.can_send && !state.sending
  const canSend =
    !state.sending &&
    !state.loading &&
    !state.error &&
    state.conversation?.can_send &&
    (draft.trim() || files.length) &&
    draft.length <= MAX_LENGTH
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
  // Until the thread loads, show the inbox's copy of the participant so the header never flashes.
  const person = other || (!state.error ? preview : null)
  const rows = layoutMessages(state.items)
  const lastOwn = [...state.items].reverse().find((item) => item.sender.id === owner)
  const remaining = MAX_LENGTH - draft.length
  return (
    <section className="conversation" aria-labelledby="conversation-title">
      <header className="conversation-heading">
        <a className="messages-back" href="#/messages" aria-label="Back to conversations">
          <Icon name="back" />
          <span aria-hidden="true">Messages</span>
        </a>
        <div className="conversation-title">
          {person && (
            <a
              className="conversation-person"
              href={'#/users/' + person.id}
              aria-label={`View @${person.username}'s profile`}
            >
              <Avatar key={person.avatar} user={person} size="sm" />
            </a>
          )}
          <div className="conversation-title-text">
            <h2 id="conversation-title" ref={heading} tabIndex={-1}>
              {person ? (
                <>
                  <span className="messages-visually-hidden">
                    {other ? `Conversation with @${other.username}` : 'Loading conversation'}
                  </span>
                  <span aria-hidden="true">{displayName(person)}</span>
                </>
              ) : (
                'Conversation'
              )}
            </h2>
            {person && (
              <a className="conversation-subtitle" href={'#/users/' + person.id} tabIndex={-1}>
                {person.full_name?.trim() ? '@' + person.username : 'View profile'}
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          className="messages-icon-button"
          aria-label="Refresh messages"
          title="Refresh messages"
          disabled={state.loading}
          onClick={state.refresh}
        >
          <Icon name="refresh" />
        </button>
      </header>
      <div className="conversation-body">
        {state.loading && (
          <p
            role="status"
            className={
              state.conversation ? 'messages-visually-hidden' : 'messages-loading conversation-fill'
            }
          >
            Loading messages...
          </p>
        )}
        <ErrorNotice error={state.error} retry={state.refresh} label="Retry messages" />
        {state.conversation && (
          <>
            <div
              ref={viewport}
              className="conversation-history"
              tabIndex={0}
              aria-label="Scrollable message history"
              onScroll={(event) => {
                const box = event.currentTarget
                const bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80
                nearBottom.current = bottom
                if (bottom !== atBottom) setAtBottom(bottom)
                if (box.scrollTop < 40 && state.cursor && !state.olderLoading && !state.olderError)
                  void older()
              }}
            >
              <div className="conversation-history-start">
                {state.cursor ? (
                  <button
                    type="button"
                    className="messages-pill-button"
                    disabled={state.olderLoading}
                    onClick={older}
                  >
                    {state.olderLoading ? 'Loading older messages...' : 'Load older messages'}
                  </button>
                ) : (
                  state.items.length > 0 &&
                  other && (
                    <div className="conversation-intro" aria-hidden="true">
                      <Avatar key={other.avatar} user={other} size="lg" />
                      <strong>{displayName(other)}</strong>
                      <span>This is the beginning of your conversation.</span>
                    </div>
                  )
                )}
                <ErrorNotice error={state.olderError} compact />
              </div>
              {!state.items.length && !state.loading && other && (
                <div className="messages-empty conversation-intro">
                  <Avatar key={other.avatar} user={other} size="lg" />
                  <strong>{displayName(other)}</strong>
                  <span>No messages yet. Say hello!</span>
                </div>
              )}
              <ol
                ref={messageList}
                className="conversation-messages"
                role="log"
                aria-label="Conversation messages"
                aria-live="polite"
                aria-relevant="additions"
                aria-busy={state.loading || state.olderLoading}
              >
                {rows.map(({ item, date, separator, first, last }) => {
                  const own = item.sender.id === owner
                  const imagesOnly = !item.content && item.attachments.length > 0
                  return (
                    <li
                      key={item.id}
                      className={[
                        'message-row',
                        own ? 'message-row--own' : 'message-row--other',
                        first && 'message-row--first',
                        last && 'message-row--last',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {separator && date && (
                        <div className="message-separator" aria-hidden="true">
                          {formatSeparator(date)}
                        </div>
                      )}
                      <div
                        className={
                          'message-bubble' +
                          (own ? ' message-bubble--own' : '') +
                          (imagesOnly ? ' message-bubble--media' : '')
                        }
                        title={date ? fullTime(date) : undefined}
                      >
                        <span className="messages-visually-hidden">
                          {own ? 'You' : '@' + item.sender.username}
                          {date && (
                            <>
                              , <time dateTime={date.toISOString()}>{fullTime(date)}</time>
                            </>
                          )}
                          :{' '}
                        </span>
                        {item.content && <p>{item.content}</p>}
                        {!!item.attachments.length && (
                          <div
                            className={
                              'message-attachments message-attachments--' +
                              Math.min(item.attachments.length, 2)
                            }
                            aria-label="Message attachments"
                          >
                            {item.attachments.map((attachment, index) => (
                              <MessageImage
                                key={attachment.id}
                                attachment={attachment}
                                conversationId={id}
                                index={index}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {own && item.id === lastOwn?.id && (
                        <span className="message-receipt">
                          {item.read_at ? 'Read' : 'Delivered'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
            {!atBottom && (
              <button
                type="button"
                className="messages-icon-button conversation-jump"
                aria-label="Jump to latest"
                title="Jump to latest"
                onClick={() => scrollToLatest('smooth')}
              >
                <Icon name="down" />
              </button>
            )}
            {state.reading && (
              <span role="status" className="messages-visually-hidden">
                Updating read status...
              </span>
            )}
            <ErrorNotice
              error={state.readError}
              retry={state.markRead}
              label="Retry read status"
              compact
            />
          </>
        )}
      </div>
      {state.conversation && !state.conversation.can_send && (
        <p className="conversation-readonly" role="status">
          This conversation is read-only. Messaging is available only to accepted friends with
          messaging access.
        </p>
      )}
      <form
        className={'message-composer' + (dragging ? ' message-composer--dragging' : '')}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
        onDragEnter={(event) => {
          if (!canWrite || !Array.from(event.dataTransfer?.types || []).includes('Files')) return
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          if (!canWrite) return
          const images = Array.from(event.dataTransfer?.files || []).filter((file) =>
            file.type.startsWith('image/'),
          )
          if (!images.length) return
          addFiles(images)
        }}
      >
        {files.length > 0 && (
          <ul className="message-selected-images" aria-label="Selected images">
            {files.map((file, index) => (
              <SelectedImage
                key={file.key}
                entry={file}
                disabled={state.sending}
                remove={() => {
                  changeFiles(files.filter((_, fileIndex) => fileIndex !== index))
                  setAttachmentError('')
                }}
              />
            ))}
          </ul>
        )}
        {attachmentError && (
          <p className="message-file-warning" role="alert">
            {attachmentError}
          </p>
        )}
        <div className="message-composer-row">
          <input
            id="message-images"
            className="messages-visually-hidden"
            type="file"
            accept="image/*"
            multiple
            aria-describedby="message-attachments-help"
            disabled={!canWrite}
            onChange={(event) => {
              const selected = Array.from(event.target.files || [])
              event.target.value = ''
              if (!selected.length) return
              addFiles(selected)
            }}
          />
          <label
            htmlFor="message-images"
            className={'messages-icon-button message-attach' + (canWrite ? '' : ' is-disabled')}
            title="Attach images — you can also paste or drag them here"
          >
            <Icon name="attach" />
            <span className="messages-visually-hidden">Attach images</span>
          </label>
          <div className="message-input">
            <label htmlFor="message-draft" className="messages-visually-hidden">
              Your message
            </label>
            <textarea
              id="message-draft"
              ref={textarea}
              rows={1}
              maxLength={MAX_LENGTH}
              value={draft}
              placeholder={
                state.conversation && !state.conversation.can_send
                  ? 'Messaging unavailable'
                  : other
                    ? `Message ${displayName(other)}`
                    : 'Message'
              }
              aria-describedby="message-length message-attachments-help"
              disabled={!canWrite}
              onChange={(event) => {
                changeDraft(event.target.value)
                setNotice('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (canSend) void send()
              }}
              onPaste={(event) => {
                const images = Array.from(event.clipboardData?.files || []).filter((file) =>
                  file.type.startsWith('image/'),
                )
                if (!images.length) return
                event.preventDefault()
                addFiles(images)
              }}
            />
            <button
              type="submit"
              className="message-send"
              aria-label={state.sending ? 'Sending...' : 'Send message'}
              title="Send (Enter) · New line (Shift+Enter)"
              disabled={!canSend}
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
        <p
          id="message-length"
          className={
            draft.length >= LENGTH_WARNING
              ? 'message-length' + (remaining <= 100 ? ' message-length--critical' : '')
              : 'messages-visually-hidden'
          }
        >
          {draft.length} / {MAX_LENGTH} characters
        </p>
        <p id="message-attachments-help" className="messages-visually-hidden">
          Attach up to 5 images. You can also send images without text.
        </p>
        {state.sendError && (
          <div className="message-send-error">
            <ErrorNotice error={state.sendError} compact />
            <p>
              Your draft is preserved. Refresh the conversation before retrying if delivery is
              uncertain.
            </p>
          </div>
        )}
        {notice && (
          <p role="status" className="messages-visually-hidden">
            {notice}
          </p>
        )}
      </form>
    </section>
  )
}

function ConnectionStatus({ value }) {
  const label =
    value === 'connected'
      ? 'Live updates connected'
      : value === 'connecting'
        ? 'Connecting to live updates...'
        : 'Live updates unavailable. Reconnecting when possible; you can refresh manually.'
  const short = value === 'connected' ? 'Live' : value === 'connecting' ? 'Connecting…' : 'Offline'
  return (
    <p className={'messages-connection messages-connection--' + value} role="status" title={label}>
      <span className="messages-connection-dot" aria-hidden="true" />
      <span aria-hidden="true">{short}</span>
      <span className="messages-visually-hidden">{label}</span>
    </p>
  )
}

function MessagesSession({ conversationId, owner }) {
  const inbox = useInbox()
  const { messageConnection } = useNotifications()
  const [drafts, setDrafts] = useState({})
  const [imageDrafts, setImageDrafts] = useState({})
  const [query, setQuery] = useState('')
  const imageDraftsRef = useRef(imageDrafts)
  useEffect(
    () => () => {
      Object.values(imageDraftsRef.current)
        .flat()
        .forEach((entry) => URL.revokeObjectURL(entry.previewUrl))
    },
    [],
  )
  function changeImageDraft(id, next) {
    const retained = new Set(next.map((entry) => entry.previewUrl))
    for (const entry of imageDrafts[id] || [])
      if (!retained.has(entry.previewUrl)) URL.revokeObjectURL(entry.previewUrl)
    const updated = { ...imageDrafts, [id]: next }
    imageDraftsRef.current = updated
    setImageDrafts(updated)
  }
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? inbox.items.filter((item) =>
        [item.other_user.username, item.other_user.full_name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle)),
      )
    : inbox.items
  return (
    <div className="messages-page">
      <div className={'messages-layout' + (conversationId ? ' messages-layout--open' : '')}>
        <section className="messages-inbox" aria-labelledby="messages-title">
          <header className="messages-inbox-heading">
            <div className="messages-inbox-title">
              <h1 id="messages-title">Messages</h1>
              <ConnectionStatus value={messageConnection} />
            </div>
            <button
              type="button"
              className="messages-icon-button"
              aria-label="Refresh conversations"
              title="Refresh conversations"
              disabled={inbox.loading}
              onClick={() => inbox.load()}
            >
              <Icon name="refresh" />
            </button>
          </header>
          <p className="messages-visually-hidden">Private conversations with your friends.</p>
          <div className="messages-search">
            <Icon name="search" />
            <label htmlFor="messages-search" className="messages-visually-hidden">
              Search conversations
            </label>
            <input
              id="messages-search"
              type="search"
              placeholder="Search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {inbox.loading && (
            <p
              role="status"
              className={inbox.items.length ? 'messages-visually-hidden' : 'messages-loading'}
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
            <p className="messages-empty messages-inbox-empty">
              No conversations on this page. <a href="#/account">Open your friends list</a> to start
              a conversation.
            </p>
          )}
          {!!needle && !visible.length && !!inbox.items.length && (
            <p className="messages-empty messages-inbox-empty">No results for “{query.trim()}”.</p>
          )}
          <ul className="conversation-list" aria-label="Conversations" aria-busy={inbox.loading}>
            {visible.map((item) => {
              const date = parseDate(item.last_message?.created_at)
              const unread = item.unread_count > 0
              const fromOwner = item.last_message?.sender_id === owner
              return (
                <li key={item.id}>
                  <a
                    className={'conversation-link' + (unread ? ' conversation-link--unread' : '')}
                    href={'#/messages/' + item.id}
                    aria-current={Number(conversationId) === item.id ? 'page' : undefined}
                  >
                    <span className="conversation-unread-dot" aria-hidden="true" />
                    <Avatar key={item.other_user.avatar} user={item.other_user} />
                    <div className="conversation-link-body">
                      <div className="conversation-link-top">
                        <strong>
                          {item.other_user.full_name?.trim() || '@' + item.other_user.username}
                        </strong>
                        {date && (
                          <time dateTime={date.toISOString()} title={fullTime(date)}>
                            {formatListTime(date)}
                          </time>
                        )}
                      </div>
                      {item.other_user.full_name?.trim() && (
                        <small>@{item.other_user.username}</small>
                      )}
                      <p>
                        {fromOwner && item.last_message?.content && (
                          <span className="conversation-preview-you">You: </span>
                        )}
                        {messagePreview(item.last_message)}
                      </p>
                    </div>
                    {unread && (
                      <span
                        className="conversation-unread"
                        aria-label={item.unread_count + ' unread messages'}
                      >
                        {item.unread_count > 99 ? '99+' : item.unread_count}
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
          {(inbox.page > 0 || inbox.more) && (
            <nav className="messages-pagination" aria-label="Conversation pages">
              <button
                type="button"
                className="messages-text-button"
                disabled={inbox.loading || inbox.page === 0}
                onClick={() => inbox.load(inbox.page - 1)}
              >
                Previous
              </button>
              <span>Page {inbox.page + 1}</span>
              <button
                type="button"
                className="messages-text-button"
                disabled={inbox.loading || !inbox.more}
                onClick={() => inbox.load(inbox.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </section>
        {conversationId ? (
          <Conversation
            key={conversationId}
            id={conversationId}
            owner={owner}
            preview={
              inbox.items.find((item) => item.id === Number(conversationId))?.other_user || null
            }
            draft={drafts[conversationId] || ''}
            files={imageDrafts[conversationId] || []}
            changeDraft={(value) => setDrafts((old) => ({ ...old, [conversationId]: value }))}
            changeFiles={(value) => changeImageDraft(conversationId, value)}
            onInboxUpdate={inbox.load}
          />
        ) : (
          <section className="messages-placeholder" aria-labelledby="messages-placeholder-title">
            <span className="messages-placeholder-icon">
              <Icon name="bubble" />
            </span>
            <h2 id="messages-placeholder-title">Choose a conversation</h2>
            <p>Open a conversation from the list, or use Message on a friend's profile.</p>
            <a className="messages-pill-button" href="#/account">
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
