import { useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Pagination from '../../components/Pagination/Pagination'
import Dialog from '../../components/Dialog/Dialog'
import { useAuth } from '../../auth/context'
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportArticles,
  getSupportTicketDetails,
  sendSupportTicketMessage,
  supportError,
} from '../../api/support'
import { readStoreLocation } from '../../utils/location'
import chevronRight from '../../assets/icon-chevron-right.svg'
import searchIcon from '../../assets/icon-search.svg'
import './SupportPage.css'

const ARTICLES_PER_PAGE = 8

/* ---------- Presentation helpers ---------- */

const STATUS_LABELS = {
  open: 'Received',
  in_progress: 'In progress',
  waiting_for_customer: 'Waiting for your reply',
  resolved: 'Resolved',
  closed: 'Closed',
}
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' }
const TRACK = [
  { id: 'open', label: 'Received' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
]

function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || '').replaceAll('_', ' ')
}

/** Position on the Received → In progress → Resolved track. */
function trackStep(status) {
  if (status === 'resolved' || status === 'closed') return 2
  if (status === 'in_progress' || status === 'waiting_for_customer') return 1
  return 0
}

/** Support timestamps are UTC without a zone suffix; read them as UTC, not local time. */
function serverDate(value) {
  if (typeof value !== 'string') return new Date(NaN)
  return new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : value + 'Z')
}

function relativeTime(value) {
  const date = serverDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fullTime(value) {
  const date = serverDate(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

function readRequestParam() {
  const value = Number(readStoreLocation().params.get('request'))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function setRequestParam(id) {
  // Keep the open request shareable without re-running the router.
  window.history.replaceState(null, '', id ? `#/support?request=${id}` : '#/support')
}

function supportEventText(item) {
  if (item.event_type === 'status_changed')
    return `Status changed from ${item.old_value?.replaceAll('_', ' ') || 'new'} to ${item.new_value?.replaceAll('_', ' ')}`
  if (item.event_type === 'priority_changed')
    return `Priority changed from ${item.old_value} to ${item.new_value}`
  return 'Support agent assignment changed'
}

/* ---------- Help articles ---------- */

function SupportArticle({ item, isOpen, onToggle }) {
  const panelId = `support-article-${item.id}-panel`
  return (
    <article className={`support-article${isOpen ? ' support-article--open' : ''}`}>
      <button
        className="support-article__button"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="support-article__title">{item.title}</span>
        {item.category && (
          <span className="support-article__category" aria-hidden="true">
            {item.category}
          </span>
        )}
        <img src={chevronRight} alt="" />
      </button>
      {isOpen && (
        <div className="support-article__panel" id={panelId}>
          <div className="support-article__content">
            <ReactMarkdown>{item.content_md}</ReactMarkdown>
          </div>
          <p className="support-article__followup">
            Still stuck? Describe the problem in a support request below.
          </p>
        </div>
      )}
    </article>
  )
}

/** Categories taken from the published articles, used as quick filters. */
function useArticleCategories() {
  const [categories, setCategories] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    getSupportArticles({ page: 1, pageSize: 100, q: '' }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        const names = [...new Set(result.items.map((item) => item.category).filter(Boolean))]
        setCategories(names.sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => {
        /* Categories are a shortcut; the article list reports its own errors. */
      })
    return () => controller.abort()
  }, [])
  return categories
}

/* ---------- Request conversation (dialog) ---------- */

function StatusTrack({ status }) {
  const step = trackStep(status)
  return (
    <ol className="support-track" aria-label="Request progress">
      {TRACK.map((item, index) => (
        <li
          key={item.id}
          className={
            'support-track__step' +
            (index < step ? ' is-done' : '') +
            (index === step ? ' is-current' : '')
          }
          aria-current={index === step ? 'step' : undefined}
        >
          <span className="support-track__marker" aria-hidden="true">
            {index + 1}
          </span>
          {index === 2 && status === 'closed' ? 'Closed' : item.label}
        </li>
      ))}
    </ol>
  )
}

function SupportTicketConversation({ ticket, ownerId, onUpdated, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [notice, setNotice] = useState('')
  const sendRequest = useRef(null)
  const thread = useRef(null)
  const inputId = `support-reply-${ticket.id}`
  const titleId = `support-thread-${ticket.id}`

  useEffect(() => {
    const controller = new AbortController()
    getSupportTicketDetails(ticket.id, ownerId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(supportError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [ownerId, ticket.id, reload])

  useEffect(() => () => sendRequest.current?.abort(), [])
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight
  }, [detail])

  async function submit(event) {
    event.preventDefault()
    setSendError('')
    setNotice('')
    const controller = new AbortController()
    sendRequest.current = controller
    setSending(true)
    try {
      await sendSupportTicketMessage(ticket.id, draft, controller.signal)
      if (controller.signal.aborted) return
      setDraft('')
      setNotice('Reply sent.')
      setLoading(true)
      setReload((value) => value + 1)
      onUpdated()
    } catch (error) {
      if (!controller.signal.aborted) setSendError(supportError(error))
    } finally {
      if (sendRequest.current === controller) sendRequest.current = null
      if (!controller.signal.aborted) setSending(false)
    }
  }

  const status = detail?.status || ticket.status
  // Messages and status events in one timeline, oldest first.
  const timeline = detail
    ? [
        ...detail.messages.map((item) => ({ kind: 'message', item })),
        ...detail.events.map((item) => ({ kind: 'event', item })),
      ].sort((a, b) => serverDate(a.item.created_at) - serverDate(b.item.created_at))
    : []

  return (
    <Dialog className="support-dialog" labelledBy={titleId} busy={sending} onClose={onClose}>
      <header className="support-dialog__header">
        <p className="support-dialog__ref">
          Request #{ticket.id},{' '}
          {(PRIORITY_LABELS[ticket.priority] || ticket.priority).toLowerCase()} priority
        </p>
        <h2 id={titleId}>
          <span className="support-visually-hidden">Conversation for request #{ticket.id}</span>
          <span aria-hidden="true">{ticket.subject}</span>
        </h2>
        <StatusTrack status={status} />
        {status === 'waiting_for_customer' && (
          <p className="support-dialog__callout">
            The support team replied and is waiting for your answer.
          </p>
        )}
      </header>

      <div className="support-dialog__thread" ref={thread}>
        {loading && !detail && <p role="status">Loading conversation...</p>}
        {loadError && (
          <div className="support-error" role="alert">
            <p>{loadError}</p>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                setReload((value) => value + 1)
              }}
            >
              Retry conversation
            </button>
          </div>
        )}
        {detail && (
          <ol className="support-message-list" aria-label="Support conversation" aria-live="polite">
            {timeline.map(({ kind, item }) =>
              kind === 'event' ? (
                <li className="support-event" key={'event-' + item.id}>
                  <span>{supportEventText(item)}</span>
                  <time dateTime={item.created_at} title={fullTime(item.created_at)}>
                    {relativeTime(item.created_at)}
                  </time>
                </li>
              ) : (
                <li
                  className={`support-message${item.sender_role === 'staff' ? ' support-message--staff' : ''}`}
                  key={'message-' + item.id}
                >
                  <div className="support-message__heading">
                    <strong>{item.sender_role === 'staff' ? 'Support team' : 'You'}</strong>
                    <time dateTime={item.created_at} title={fullTime(item.created_at)}>
                      {relativeTime(item.created_at)}
                    </time>
                  </div>
                  <p>{item.body}</p>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      {status === 'closed' ? (
        <p className="support-dialog__closed">
          This request is closed and cannot receive replies. Open a new request if you still need
          help.
        </p>
      ) : (
        <form className="support-reply-form" onSubmit={submit}>
          <label htmlFor={inputId}>Your reply</label>
          <textarea
            id={inputId}
            rows={3}
            maxLength={10000}
            value={draft}
            disabled={sending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="support-reply-form__footer">
            <span className="support-field-count">{draft.length} / 10000 characters</span>
            <button
              className="button button--accent"
              type="submit"
              disabled={sending || !draft.trim() || !!loadError}
            >
              {sending ? 'Sending reply...' : 'Send reply'}
            </button>
          </div>
          {sendError && (
            <p className="support-error" role="alert">
              {sendError}
            </p>
          )}
          {notice && (
            <p className="support-notice" role="status">
              {notice}
            </p>
          )}
        </form>
      )}
    </Dialog>
  )
}

/* ---------- Requests: new request form and request list ---------- */

function SuggestedArticles({ subject }) {
  const [items, setItems] = useState([])
  const query = subject.trim()
  useEffect(() => {
    if (query.length < 3) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getSupportArticles({ page: 1, pageSize: 3, q: query }, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setItems(result.items)
        })
        .catch(() => {
          /* Suggestions are optional. */
        })
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])
  if (query.length < 3 || !items.length) return null
  return (
    <aside className="support-suggestions" aria-label="Articles that may help">
      <p>These articles may answer your question:</p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <details>
              <summary>{item.title}</summary>
              <div className="support-article__content">
                <ReactMarkdown>{item.content_md}</ReactMarkdown>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function SupportTicket({ item, selected, onOpen }) {
  const lastActivity = item.last_message_at || item.updated_at
  const step = trackStep(item.status)
  return (
    <article className={`support-ticket support-ticket--${item.status}`}>
      <header className="support-ticket__heading">
        <h3>{item.subject}</h3>
        <span className={`support-ticket__status support-ticket__status--${item.status}`}>
          {statusLabel(item.status)}
        </span>
      </header>
      {/* The open request shows its full first message in the dialog instead. */}
      {!selected && <p className="support-ticket__message">{item.message}</p>}
      <div
        className="support-ticket__progress"
        role="img"
        aria-label={`Progress: ${statusLabel(item.status)}`}
      >
        {TRACK.map((track, index) => (
          <span key={track.id} className={index <= step ? 'is-filled' : ''} />
        ))}
      </div>
      <div className="support-ticket__footer">
        <span>
          Request #{item.id}, updated{' '}
          <time dateTime={lastActivity} title={fullTime(lastActivity)}>
            {relativeTime(lastActivity)}
          </time>
        </span>
        <button className="button button--secondary" type="button" onClick={onOpen}>
          Open conversation ({item.message_count})
        </button>
      </div>
    </article>
  )
}

function SupportRequests({ ownerId }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('medium')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('active')
  const [selectedTicketId, setSelectedTicketId] = useState(readRequestParam)
  const sendRequest = useRef(null)
  const filterId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getMySupportTickets(ownerId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTickets(result)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(supportError(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [ownerId, reload])

  useEffect(() => () => sendRequest.current?.abort(), [])
  useEffect(() => {
    // Notifications link to #/support?request=ID; follow later changes too.
    const sync = () => setSelectedTicketId(readRequestParam())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function refresh() {
    setLoading(true)
    setLoadError('')
    setReload((value) => value + 1)
  }

  function open(id) {
    setSelectedTicketId(id)
    setRequestParam(id)
  }

  async function submit(event) {
    event.preventDefault()
    setSendError('')
    setNotice('')
    const controller = new AbortController()
    sendRequest.current = controller
    setSending(true)
    try {
      const created = await createSupportTicket(
        { subject, message, priority },
        ownerId,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setTickets((previous) => [created, ...previous.filter((item) => item.id !== created.id)])
      setLoadError('')
      setSubject('')
      setMessage('')
      setPriority('medium')
      setFilter('active')
      setNotice('Your support request was submitted.')
    } catch (error) {
      if (!controller.signal.aborted) setSendError(supportError(error))
    } finally {
      if (sendRequest.current === controller) sendRequest.current = null
      if (!controller.signal.aborted) setSending(false)
    }
  }

  const activeCount = tickets.filter((item) => !['resolved', 'closed'].includes(item.status)).length
  const visible = tickets.filter((item) =>
    filter === 'all' ? true : !['resolved', 'closed'].includes(item.status),
  )
  const selected = tickets.find((item) => item.id === selectedTicketId)

  return (
    <section className="support-requests" aria-labelledby="support-requests-title">
      <header className="support-section-heading">
        <h2 id="support-requests-title">Your support requests</h2>
        <p>Didn't find an answer? Our team replies here and notifies you when there is news.</p>
      </header>
      <div className="support-requests__layout">
        <form className="support-request-form" onSubmit={submit}>
          <h3>Contact support</h3>
          <label htmlFor="support-subject">Subject</label>
          <input
            id="support-subject"
            type="text"
            maxLength={255}
            placeholder="For example: Refund for a game I bought by mistake"
            value={subject}
            disabled={sending}
            onChange={(event) => setSubject(event.target.value)}
          />
          <SuggestedArticles subject={subject} />
          <label htmlFor="support-message">Describe your issue</label>
          <textarea
            id="support-message"
            rows={6}
            maxLength={10000}
            placeholder="What happened, which game or order it concerns, and what you already tried."
            value={message}
            disabled={sending}
            onChange={(event) => setMessage(event.target.value)}
          />
          <span className="support-field-count">{message.length} / 10000 characters</span>
          <label htmlFor="support-priority">Priority</label>
          <select
            id="support-priority"
            value={priority}
            disabled={sending}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          {sendError && (
            <p className="support-error" role="alert">
              {sendError}
            </p>
          )}
          {notice && (
            <p className="support-notice" role="status">
              {notice}
            </p>
          )}
          <button
            className="button button--accent"
            type="submit"
            disabled={sending || !subject.trim() || !message.trim()}
          >
            {sending ? 'Submitting request...' : 'Submit request'}
          </button>
        </form>

        <div className="support-request-list">
          <div className="support-request-list__heading">
            <h3>Request history</h3>
            <div className="support-filter" role="group" aria-labelledby={filterId}>
              <span id={filterId} className="support-visually-hidden">
                Show requests
              </span>
              <button
                type="button"
                aria-pressed={filter === 'active'}
                onClick={() => setFilter('active')}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                All ({tickets.length})
              </button>
            </div>
            <button
              className="button button--secondary"
              type="button"
              disabled={loading}
              onClick={refresh}
            >
              Refresh requests
            </button>
          </div>
          {loading && <p role="status">Loading your requests...</p>}
          {loadError && (
            <div className="support-error" role="alert">
              <p>{loadError}</p>
              <button className="button button--secondary" type="button" onClick={refresh}>
                Retry requests
              </button>
            </div>
          )}
          {!loading && !loadError && tickets.length === 0 && (
            <p className="support-request-empty">
              You have not submitted any requests yet. Use the form to describe your problem.
            </p>
          )}
          {!loading && !loadError && tickets.length > 0 && visible.length === 0 && (
            <p className="support-request-empty">
              No active requests.{' '}
              <button type="button" onClick={() => setFilter('all')}>
                Show all requests
              </button>
            </p>
          )}
          {visible.length > 0 && (
            <ul className="support-ticket-list" aria-label="Your support request history">
              {visible.map((item) => (
                <li key={item.id}>
                  <SupportTicket
                    item={item}
                    selected={item.id === selectedTicketId}
                    onOpen={() => open(item.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {selected && (
        <SupportTicketConversation
          key={selected.id}
          ticket={selected}
          ownerId={ownerId}
          onUpdated={refresh}
          onClose={() => open(null)}
        />
      )}
    </section>
  )
}

/* ---------- Page ---------- */

function SupportPage() {
  const auth = useAuth() || {}
  const ownerId = auth.isAuthenticated ? Number(auth.currentUser?.id) : null
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [openArticleId, setOpenArticleId] = useState(null)
  const [articles, setArticles] = useState({ items: [], total: 0, page_size: ARTICLES_PER_PAGE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const categories = useArticleCategories()
  // The API searches titles, text and categories with one query.
  const search = query.trim() || category

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(
      () => {
        getSupportArticles(
          { page: currentPage, pageSize: ARTICLES_PER_PAGE, q: search },
          controller.signal,
        )
          .then((result) => {
            if (active) setArticles(result)
          })
          .catch((reason) => {
            if (active && !controller.signal.aborted) setError(supportError(reason))
          })
          .finally(() => {
            if (active && !controller.signal.aborted) setLoading(false)
          })
      },
      query ? 250 : 0,
    )
    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [currentPage, search, query, retry])

  function changeFilter(next) {
    setCurrentPage(1)
    setLoading(true)
    setError('')
    next()
  }

  // A chosen category also narrows text search results on this page.
  const items =
    category && query.trim()
      ? articles.items.filter((item) => item.category === category)
      : articles.items

  return (
    <div className="support-page">
      <header className="support-hero">
        <div className="support-page__inner">
          <h1>Support</h1>
          <p>Answers to common questions about purchases, refunds, your account and games.</p>
          <label className="support-search" aria-label="Find help">
            <img src={searchIcon} alt="" />
            <input
              type="search"
              placeholder="Find help"
              maxLength={200}
              value={query}
              onChange={(event) => {
                const value = event.target.value
                changeFilter(() => setQuery(value))
              }}
            />
          </label>
          {categories.length > 0 && (
            <div className="support-categories" role="group" aria-label="Help categories">
              <button
                type="button"
                aria-pressed={!category}
                onClick={() => changeFilter(() => setCategory(''))}
              >
                All topics
              </button>
              {categories.map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={category === name}
                  onClick={() => changeFilter(() => setCategory(category === name ? '' : name))}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="support-page__inner support-page__body">
        <section className="support-help" aria-labelledby="support-help-title">
          <header className="support-section-heading">
            <h2 id="support-help-title">Help articles</h2>
            {!loading && !error && (
              <p>
                {articles.total} article{articles.total === 1 ? '' : 's'}
                {search ? ` for "${search}"` : ''}
              </p>
            )}
          </header>
          <div className="support-topics" aria-label="Support articles" aria-busy={loading}>
            {loading && articles.items.length === 0 && (
              <p role="status">Loading help articles...</p>
            )}
            {error && (
              <div className="support-error" role="alert">
                <p>{error}</p>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    setLoading(true)
                    setError('')
                    setRetry((value) => value + 1)
                  }}
                >
                  Retry articles
                </button>
              </div>
            )}
            {items.map((item) => (
              <SupportArticle
                key={item.id}
                item={item}
                isOpen={openArticleId === item.id}
                onToggle={() => setOpenArticleId((id) => (id === item.id ? null : item.id))}
              />
            ))}
            {!loading && !error && items.length === 0 && (
              <div className="support-empty">
                <p>
                  {search
                    ? 'No help articles match your search. Try other words or contact support below.'
                    : 'No help articles are available yet.'}
                </p>
              </div>
            )}
          </div>
          {loading && articles.items.length > 0 && (
            <p className="support-visually-hidden" role="status">
              Updating help articles...
            </p>
          )}
          <Pagination
            activeClassName="support-pagination__active"
            ariaLabel="Support article pages"
            className="support-pagination"
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page)
              setLoading(true)
              setError('')
            }}
            pageSize={ARTICLES_PER_PAGE}
            totalItems={articles.total}
          />
        </section>

        {Number.isSafeInteger(ownerId) && ownerId > 0 ? (
          <SupportRequests key={ownerId} ownerId={ownerId} />
        ) : (
          <section
            className="support-requests support-requests--guest"
            aria-label="Submit a support request"
          >
            <h2>Contact support</h2>
            <p>Sign in to send a request to the support team and follow its progress here.</p>
            <a className="button button--accent" href="#/login">
              Sign in
            </a>
          </section>
        )}
      </div>
    </div>
  )
}

export default SupportPage
