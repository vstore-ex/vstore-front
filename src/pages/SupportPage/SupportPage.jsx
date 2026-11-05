import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Pagination from '../../components/Pagination/Pagination'
import { useAuth } from '../../auth/context'
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportArticles,
  supportError,
} from '../../api/support'
import chevronRight from '../../assets/icon-chevron-right.svg'
import searchIcon from '../../assets/icon-search.svg'
import './SupportPage.css'

const ARTICLES_PER_PAGE = 8

function SupportArticle({ item, isOpen, onToggle }) {
  const panelId = `support-article-${item.id}-panel`
  return (
    <article className={`support-topic${isOpen ? ' support-topic--open' : ''}`}>
      <button
        className="support-topic__button"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{item.title}</span>
        <img src={chevronRight} alt="" />
      </button>
      {isOpen && (
        <div className="support-topic__panel" id={panelId}>
          {item.category && <p className="support-article__category">{item.category}</p>}
          <div className="support-article__content">
            <ReactMarkdown>{item.content_md}</ReactMarkdown>
          </div>
        </div>
      )}
    </article>
  )
}

function SupportTicket({ item }) {
  const date = new Date(item.created_at)
  return (
    <article className="support-ticket">
      <header className="support-ticket__heading">
        <div>
          <h3>{item.subject}</h3>
          <p>Request #{item.id}</p>
        </div>
        <div className="support-ticket__meta">
          <span className={`support-ticket__status support-ticket__status--${item.status}`}>
            {item.status}
          </span>
          <span>Priority: {item.priority}</span>
        </div>
      </header>
      <p className="support-ticket__message">{item.message}</p>
      <time dateTime={item.created_at}>{date.toLocaleString()}</time>
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
  const sendRequest = useRef(null)

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
      setNotice('Your support request was submitted.')
    } catch (error) {
      if (!controller.signal.aborted) setSendError(supportError(error))
    } finally {
      if (sendRequest.current === controller) sendRequest.current = null
      if (!controller.signal.aborted) setSending(false)
    }
  }

  return (
    <section className="support-requests" aria-labelledby="support-requests-title">
      <h2 id="support-requests-title">Your support requests</h2>
      <form className="support-request-form" onSubmit={submit}>
        <h3>Contact support</h3>
        <label htmlFor="support-subject">Subject</label>
        <input
          id="support-subject"
          type="text"
          maxLength={255}
          required
          value={subject}
          disabled={sending}
          onChange={(event) => setSubject(event.target.value)}
        />
        <span className="support-field-count">{subject.length} / 255 characters</span>
        <label htmlFor="support-message">Describe your issue</label>
        <textarea
          id="support-message"
          rows={5}
          maxLength={10000}
          required
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
          <button
            className="button button--secondary"
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              setLoadError('')
              setReload((value) => value + 1)
            }}
          >
            Refresh requests
          </button>
        </div>
        {loading && <p role="status">Loading your requests...</p>}
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
              Retry requests
            </button>
          </div>
        )}
        {!loading && !loadError && tickets.length === 0 && (
          <p className="support-request-empty">You have not submitted any requests yet.</p>
        )}
        {tickets.length > 0 && (
          <ul className="support-ticket-list" aria-label="Your support request history">
            {tickets.map((item) => (
              <li key={item.id}>
                <SupportTicket item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function SupportPage() {
  const auth = useAuth() || {}
  const ownerId = auth.isAuthenticated ? Number(auth.currentUser?.id) : null
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [openArticleId, setOpenArticleId] = useState(null)
  const [articles, setArticles] = useState({ items: [], total: 0, page_size: ARTICLES_PER_PAGE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(
      () => {
        getSupportArticles(
          { page: currentPage, pageSize: ARTICLES_PER_PAGE, q: query },
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
  }, [currentPage, query, retry])

  return (
    <div className="support-page">
      <div className="support-page__inner">
        <h1>Support</h1>
        <label className="support-search" aria-label="Find help">
          <img src={searchIcon} alt="" />
          <input
            type="search"
            placeholder="Find help"
            maxLength={200}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCurrentPage(1)
              setLoading(true)
              setError('')
            }}
          />
        </label>

        <section className="support-topics" aria-label="Support articles" aria-busy={loading}>
          {loading && articles.items.length === 0 && <p role="status">Loading help articles...</p>}
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
          {articles.items.map((item) => (
            <SupportArticle
              key={item.id}
              item={item}
              isOpen={openArticleId === item.id}
              onToggle={() => setOpenArticleId((id) => (id === item.id ? null : item.id))}
            />
          ))}
          {!loading && !error && articles.items.length === 0 && (
            <div className="support-empty">
              <p>
                {query
                  ? 'No help articles match your search.'
                  : 'No help articles are available yet.'}
              </p>
            </div>
          )}
        </section>
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

        {Number.isSafeInteger(ownerId) && ownerId > 0 ? (
          <SupportRequests key={ownerId} ownerId={ownerId} />
        ) : (
          <section className="support-requests" aria-label="Submit a support request">
            <h2>Contact support</h2>
            <p>Sign in to submit a request and view its status.</p>
            <a className="button button--accent" href="#/login">
              Sign in
            </a>
          </section>
        )}

        <section className="support-contact" aria-label="Contact support by email">
          <h2>Have another question?</h2>
          <a href="mailto:support@vstore.local">Contact us by email</a>
        </section>
      </div>
    </div>
  )
}

export default SupportPage
