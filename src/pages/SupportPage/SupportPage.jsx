import { useMemo, useState } from 'react'
import Pagination from '../../components/Pagination/Pagination'
import chevronRight from '../../assets/icon-chevron-right.svg'
import searchIcon from '../../assets/icon-search.svg'
import { supportTopics } from '../../data/support'
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
          <p>{topic.description}</p>
        </div>
      )}
    </article>
  )
}

function SupportPage({ topics = supportTopics }) {
  const [query, setQuery] = useState('')
  const [openTopicId, setOpenTopicId] = useState(topics[0]?.id)
  const [currentPage, setCurrentPage] = useState(1)

  const visibleTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return topics
    }

    return topics.filter((topic) =>
      `${topic.title} ${topic.description}`.toLowerCase().includes(normalizedQuery),
    )
  }, [query, topics])

  const totalPages = Math.max(1, Math.ceil(visibleTopics.length / TOPICS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const currentTopics = useMemo(() => {
    const start = (safeCurrentPage - 1) * TOPICS_PER_PAGE
    return visibleTopics.slice(start, start + TOPICS_PER_PAGE)
  }, [safeCurrentPage, visibleTopics])

  function handleTopicToggle(topicId) {
    setOpenTopicId((current) => (current === topicId ? null : topicId))
  }

  return (
    <div className="support-page">
      <div className="support-page__inner">
        <h1>Support</h1>

        <label className="support-search" aria-label="Find help">
          <img src={searchIcon} alt="" />
          <input
            type="search"
            placeholder="Find help"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCurrentPage(1)
            }}
          />
        </label>

        <section className="support-topics" aria-label="Support topics">
          {currentTopics.map((topic) => (
            <SupportTopic
              topic={topic}
              isOpen={openTopicId === topic.id}
              onToggle={() => handleTopicToggle(topic.id)}
              key={topic.id}
            />
          ))}

          {visibleTopics.length === 0 && (
            <div className="support-empty">
              <p>No help topics found.</p>
            </div>
          )}
        </section>

        <Pagination
          activeClassName="support-pagination__active"
          ariaLabel="Support pages"
          className="support-pagination"
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          pageSize={TOPICS_PER_PAGE}
          totalItems={visibleTopics.length}
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
