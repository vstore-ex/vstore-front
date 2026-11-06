import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context'
import {
  getMessageAttachment,
  messageError,
  messageFilesError,
  messagePreview,
} from '../../api/messages'
import useInbox from '../../messages/useInbox'
import useConversation from '../../messages/useConversation'
import fallbackAvatar from '../../assets/avatar.webp'
import ImageViewer from '../../components/ImageViewer'
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
    edit: <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
    trash: (
      <>
        <path d="M4 6h16" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
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
function MessageImage({ attachment, conversationId, index, onView }) {
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
    <button
      type="button"
      className="message-image-link"
      onClick={() => onView(index)}
      aria-label={`Open image ${index + 1}`}
      title="Open image"
    >
      <img className="message-image" src={imageUrl} alt={`Private message image ${index + 1}`} />
    </button>
  ) : (
    <div className="message-image-placeholder">
      <span className="messages-visually-hidden" role="status">
        Loading private image {index + 1}...
      </span>
    </div>
  )
}
function MessageVideo({ attachment, conversationId }) {
  const [videoUrl, setVideoUrl] = useState('')
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
        setVideoUrl(objectUrl)
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
      <div className="message-attachment-error" role="group" aria-label="Private video">
        <p role="alert">Could not load private video: {error}</p>
        <button
          type="button"
          className="messages-text-button"
          onClick={() => {
            setError('')
            setAttempt((value) => value + 1)
          }}
        >
          Retry video
        </button>
      </div>
    )
  return videoUrl ? (
    <video className="message-video" src={videoUrl} controls preload="metadata" />
  ) : (
    <div className="message-image-placeholder">
      <span className="messages-visually-hidden" role="status">
        Loading private video...
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

function SelectedVideo({ entry, remove, disabled }) {
  return (
    <li className="message-selected-image message-selected-video">
      <video src={entry.previewUrl} muted preload="metadata" />
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
  const [editing, setEditing] = useState(null)
  const [atBottom, setAtBottom] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [viewer, setViewer] = useState(null)
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
  function startEdit(item) {
    setEditing({ id: item.id, draft: item.content || '' })
    setNotice('')
  }
  async function saveEdit() {
    if (!editing) return
    if (await state.edit(editing.id, editing.draft)) setEditing(null)
  }
  function removeFromMessages(item) {
    setEditing((current) => (current?.id === item.id ? null : current))
    void state.remove(item.id)
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
                  const deleted = !!item.deleted_at
                  const editingThis = editing?.id === item.id
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
                        {editing && editingThis ? (
                          <form
                            className="message-edit"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void saveEdit()
                            }}
                          >
                            <textarea
                              className="message-edit-input"
                              rows={2}
                              maxLength={4000}
                              autoFocus
                              value={editing.draft}
                              onChange={(event) =>
                                setEditing((current) =>
                                  current ? { ...current, draft: event.target.value } : current,
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  setEditing(null)
                                }
                                if (event.key === 'Enter' && !event.shiftKey) {
                                  event.preventDefault()
                                  void saveEdit()
                                }
                              }}
                            />
                            <div className="message-edit-actions">
                              <span className="message-edit-hint">
                                Enter saves, Shift+Enter inserts a newline.
                              </span>
                              <button type="submit" className="messages-text-button">
                                Save
                              </button>
                              <button
                                type="button"
                                className="messages-text-button"
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : deleted ? (
                          <p className="message-deleted-note" role="status">
                            Message deleted
                          </p>
                        ) : (
                          <>
                            {item.content && (
                              <p>
                                {item.content}
                                {item.edited_at && (
                                  <span className="message-edited"> (edited)</span>
                                )}
                              </p>
                            )}
                            {!!item.attachments.length && (
                              <div
                                className={
                                  'message-attachments message-attachments--' +
                                  Math.min(item.attachments.length, 2)
                                }
                                aria-label="Message attachments"
                              >
                                {item.attachments.map((attachment) => {
                                  if (attachment.content_type !== 'image/webp')
                                    return (
                                      <MessageVideo
                                        key={attachment.id}
                                        attachment={attachment}
                                        conversationId={id}
                                      />
                                    )
                                  const images = item.attachments.filter(
                                    (part) => part.content_type === 'image/webp',
                                  )
                                  const imageIndex = images.indexOf(attachment)
                                  return (
                                    <MessageImage
                                      key={attachment.id}
                                      attachment={attachment}
                                      conversationId={id}
                                      index={imageIndex}
                                      onView={(viewIndex) =>
                                        setViewer({ images, index: viewIndex })
                                      }
                                    />
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}
                        {own && !deleted && !editingThis && (
                          <span className="message-actions">
                            {item.content && (
                              <button
                                type="button"
                                className="message-action"
                                aria-label="Edit message"
                                title="Edit"
                                onClick={() => startEdit(item)}
                              >
                                <Icon name="edit" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="message-action"
                              aria-label="Delete message"
                              title="Delete"
                              onClick={() => removeFromMessages(item)}
                            >
                              <Icon name="trash" />
                            </button>
                          </span>
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
          const dropped = Array.from(event.dataTransfer?.files || []).filter(
            (file) =>
              file.type.startsWith('image/') ||
              file.type === 'video/mp4' ||
              file.type === 'video/webm',
          )
          if (!dropped.length) return
          addFiles(dropped)
        }}
      >
        {files.length > 0 && (
          <ul className="message-selected-images" aria-label="Selected attachments">
            {files.map((file, index) =>
              file.file.type.startsWith('video/') ? (
                <SelectedVideo
                  key={file.key}
                  entry={file}
                  disabled={state.sending}
                  remove={() => {
                    changeFiles(files.filter((_, fileIndex) => fileIndex !== index))
                    setAttachmentError('')
                  }}
                />
              ) : (
                <SelectedImage
                  key={file.key}
                  entry={file}
                  disabled={state.sending}
                  remove={() => {
                    changeFiles(files.filter((_, fileIndex) => fileIndex !== index))
                    setAttachmentError('')
                  }}
                />
              ),
            )}
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
            accept="image/*,video/mp4,video/webm"
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
            title="Attach images or a video — you can also paste or drag files here"
          >
            <Icon name="attach" />
            <span className="messages-visually-hidden">Attach files</span>
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
          Attach up to 5 images and one MP4/WebM video, 20 MiB in total. You can also send
          attachments without text.
        </p>
        {state.sendError && (
          <div className="message-send-error">
            <ErrorNotice error={state.sendError} compact />
            <p>
              Your draft is preserved. If delivery is uncertain, check the conversation before
              retrying.
            </p>
          </div>
        )}
        {state.editError && <ErrorNotice error={state.editError} compact />}
        {notice && (
          <p role="status" className="messages-visually-hidden">
            {notice}
          </p>
        )}
      </form>
      {viewer && (
        <ImageViewer
          conversationId={id}
          images={viewer.images}
          index={viewer.index}
          onIndex={(index) => setViewer({ images: viewer.images, index })}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  )
}

function MessagesSession({ conversationId, owner }) {
  const inbox = useInbox()
  const [drafts, setDrafts] = useState({})
  const [imageDrafts, setImageDrafts] = useState({})
  const [query, setQuery] = useState('')
  const imageDraftsRef = useRef(imageDrafts)
  const page = useRef(null)
  useLayoutEffect(() => {
    // Fill the viewport below the store header, whatever height it wraps to.
    const node = page.current
    if (!node) return
    const measure = () =>
      node.style.setProperty(
        '--messages-top',
        Math.max(0, node.getBoundingClientRect().top + window.scrollY) + 'px',
      )
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
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
    <div className="messages-page" ref={page}>
      <div className={'messages-layout' + (conversationId ? ' messages-layout--open' : '')}>
        <section className="messages-inbox" aria-labelledby="messages-title">
          <header className="messages-inbox-heading">
            <h1 id="messages-title">Messages</h1>
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
