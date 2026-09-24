import { useMemo, useState } from 'react'
import Pagination from '../../components/Pagination/Pagination'
import chevronRight from '../../assets/icon-chevron-right.svg'
import searchIcon from '../../assets/icon-search.svg'
import MarkdownView from '../../components/Markdown/MarkdownView'
import ContentStatus from '../../components/Markdown/ContentStatus'
import usePublicContent from '../../hooks/usePublicContent'
import './SupportPage.css'

const TOPICS_PER_PAGE = 8

function SupportTopic({ topic, isOpen, onToggle }) {
  return (
    <article className={`support-topic${isOpen ? ' support-topic--open' : ''}`}>
      <button
        className="support-topic__button"
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${topic.id}-panel`}
        onClick={onToggle}
      >
        <span>{topic.title}</span>
        <img src={chevronRight} alt="" />
      </button>

      {isOpen && (
        <div className="support-topic__panel" id={`${topic.id}-panel`}>
          <MarkdownView>{topic.content_md}</MarkdownView>
        </div>
      )}
    </article>
  )
}

function SupportPage() {
  const [query, setQuery] = useState('')
  const [openTopicId, setOpenTopicId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)

  const resource = usePublicContent(`/articles?page=${currentPage}&page_size=${TOPICS_PER_PAGE}`)
  const topics = resource.data?.items
  const visibleTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return topics || []
    }

    return (topics || []).filter((topic) =>
      `${topic.title} ${topic.content_md}`.toLowerCase().includes(normalizedQuery),
    )
  }, [query, topics])

  function handleTopicToggle(topicId) {
    setOpenTopicId((current) => (current === topicId ? null : topicId))
  }

  return (
    <div className="support-page">
      <div className="support-page__inner">
        <h1>Support</h1>

        <label className="support-search" aria-label="Find help on this page">
          <img src={searchIcon} alt="" />
          <input
            type="search"
            placeholder="Find help on this page"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
          />
        </label>

        <section className="support-topics" aria-label="Support topics">
          <ContentStatus resource={resource} />
          {visibleTopics.map((topic) => (
            <SupportTopic
              topic={topic}
              isOpen={openTopicId === topic.id}
              onToggle={() => handleTopicToggle(topic.id)}
              key={topic.id}
            />
          ))}

          {!resource.loading && !resource.error && visibleTopics.length === 0 && (
            <div className="support-empty">
              <p>No help topics found.</p>
            </div>
          )}
        </section>

        <Pagination
          activeClassName="support-pagination__active"
          ariaLabel="Support pages"
          className="support-pagination"
          currentPage={currentPage}
          onPageChange={page => { setCurrentPage(page); setOpenTopicId(null); setQuery('') }}
          pageSize={TOPICS_PER_PAGE}
          totalItems={resource.data?.total || 0}
        />

        <section className="support-contact" aria-label="Contact support">
          <h2>Have any other questions?</h2>
          <a href="mailto:support@vstore.local">Contact us on our email!</a>
        </section>
      </div>
    </div>
  )
}

export default SupportPage
