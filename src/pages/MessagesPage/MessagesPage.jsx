import { useEffect, useRef, useState } from 'react'
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

let nextImageDraftId = 0

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
          className="button button--secondary"
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
    <img className="message-image" src={imageUrl} alt={`Private message image ${index + 1}`} />
  ) : (
    <p className="messages-visually-hidden" role="status">
      Loading private image {index + 1}...
    </p>
  )
}
function SelectedImage({ entry, remove, disabled }) {
  return (
    <li className="message-selected-image">
      <img src={entry.previewUrl} alt={`Preview of ${entry.file.name}`} />
      <span>{entry.file.name}</span>
      <button
        type="button"
        className="button button--secondary"
        aria-label={`Remove ${entry.file.name}`}
        disabled={disabled}
        onClick={remove}
      >
        Remove
      </button>
    </li>
  )
}
function Conversation({ id, owner, draft, files, changeDraft, changeFiles, onInboxUpdate }) {
  const state = useConversation(id, owner, onInboxUpdate)
  const [notice, setNotice] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const composing = useRef(false)
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
      nearBottom.current = true
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
      setNotice('Message sent.')
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
  const canSend =
    !state.sending &&
    !state.loading &&
    !state.error &&
    state.conversation?.can_send &&
    (draft.trim() || files.length) &&
    draft.length <= 4000
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
                    <div className="message-attachments" aria-label="Message attachments">
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
      <form
        className="message-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const images = Array.from(event.dataTransfer?.files || []).filter((file) =>
            file.type.startsWith('image/'),
          )
          if (!images.length) return
          addFiles(images)
        }}
      >
        <label htmlFor="message-draft">Your message</label>
        <textarea
          id="message-draft"
          rows={4}
          maxLength={4000}
          value={draft}
          aria-describedby="message-length message-keyboard-help"
          disabled={state.sending || !state.conversation?.can_send}
          onChange={(event) => {
            changeDraft(event.target.value)
            setNotice('')
          }}
          onKeyDown={(event) => {
            if (
              event.key !== 'Enter' ||
              event.shiftKey ||
              composing.current ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            )
              return
            event.preventDefault()
            if (!event.repeat && canSend) event.currentTarget.form.requestSubmit()
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
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
        <label htmlFor="message-images">Attach images</label>
        <input
          id="message-images"
          type="file"
          accept="image/*"
          multiple
          aria-describedby="message-attachments-help"
          disabled={state.sending || !state.conversation?.can_send}
          onChange={(event) => {
            const selected = Array.from(event.target.files || [])
            event.target.value = ''
            if (!selected.length) return
            addFiles(selected)
          }}
        />
        <p id="message-attachments-help">
          Attach up to 5 images. Images can also be pasted from the clipboard or dragged here, and
          sent without text.
        </p>
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
        <p id="message-keyboard-help">Enter to send · Shift+Enter for a new line.</p>
        <div className="message-composer-actions">
          <span id="message-length">{draft.length} / 4000 characters</span>
          <button type="submit" className="button button--accent" disabled={!canSend}>
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
  const [imageDrafts, setImageDrafts] = useState({})
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
            files={imageDrafts[conversationId] || []}
            changeDraft={(value) => setDrafts((old) => ({ ...old, [conversationId]: value }))}
            changeFiles={(value) => changeImageDraft(conversationId, value)}
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
