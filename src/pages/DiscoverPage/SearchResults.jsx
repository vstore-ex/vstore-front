import { useId, useState } from 'react'
import { GameRow } from '../../components/Store/StoreParts'
import Markdown from 'react-markdown'
import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import UserLink from '../../components/User/UserLink'
import './SearchResults.css'

const categories = {
  games: {
    title: 'Games',
    loader: 'search',
    empty: 'No games found. Try another title, developer or publisher.',
  },
  people: {
    title: 'People',
    loader: 'searchPeople',
    empty: 'No people found. Try another username or full name.',
  },
  reviews: {
    title: 'Reviews',
    loader: 'searchReviews',
    empty: 'No reviews found. Try different review text.',
  },
}

function GameResult({ game, onProductSelect }) {
  return <GameRow game={game} onSelect={onProductSelect} />
}

function ReviewResult({ review }) {
  const excerpt = review.content.length > 500 ? review.content.slice(0, 500) + '…' : review.content
  return (
    <article className="search-result search-result--review" aria-label={'Review #' + review.id}>
      <h2>
        {review.positive === null ? 'Review' : review.positive ? 'Recommended' : 'Not recommended'}
      </h2>
      <div className="search-review-meta">
        {review.userId && <UserLink id={review.userId}>User #{review.userId}</UserLink>}
        {review.createdAt && (
          <time dateTime={review.createdAt}>
            {new Date(review.createdAt).toLocaleDateString('en', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </time>
        )}
      </div>
      <div className="search-review-excerpt">
        <Markdown
          skipHtml
          unwrapDisallowed
          allowedElements={['p', 'strong', 'em', 'code', 'blockquote', 'ul', 'ol', 'li']}
        >
          {excerpt}
        </Markdown>
      </div>
      {review.gameId && <a href={'#/games/' + encodeURIComponent(review.gameId)}>View game</a>}
    </article>
  )
}

function CategoryResults({ category, query, onProductSelect }) {
  const resource = useCatalogResource(categories[category].loader, query)
  return (
    <>
      <ResourceStatus resource={resource} label={category + ' search results'} />
      {resource.data && (
        <p role="status">
          {resource.data.length
            ? `${resource.data.length} matching ${category}`
            : categories[category].empty}
        </p>
      )}
      <div className={'search-results search-results--' + category}>
        {resource.data?.map((item) =>
          category === 'games' ? (
            <GameResult key={item.id} game={item} onProductSelect={onProductSelect} />
          ) : category === 'people' ? (
            <UserLink key={item.id} id={item.id} className="search-result search-result--person">
              <h2>@{item.username}</h2>
              {item.fullName && <p>{item.fullName}</p>}
              {item.role && <span>{item.role}</span>}
            </UserLink>
          ) : (
            <ReviewResult key={item.id} review={item} />
          ),
        )}
      </div>
      {resource.data?.length >= 20 && (
        <p className="catalog-empty">
          Showing the top matches. Refine your search for more specific results.
        </p>
      )}
    </>
  )
}

export default function SearchResults({ query, onProductSelect }) {
  const [category, setCategory] = useState('games')
  const id = useId()
  const keys = Object.keys(categories)
  function tabKeys(event) {
    let index = keys.indexOf(category)
    if (event.key === 'ArrowRight') index = (index + 1) % keys.length
    else if (event.key === 'ArrowLeft') index = (index + keys.length - 1) % keys.length
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = keys.length - 1
    else return
    event.preventDefault()
    setCategory(keys[index])
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[index].focus()
  }
  return (
    <div className="discover-page">
      <div className="discover-page__inner">
        <section className="discover-catalog" aria-labelledby="search-title">
          <div className="discover-catalog__heading">
            <h1 id="search-title">Search results for {query}</h1>
            <a className="discover-outline-button" href="#/discover">
              Clear search
            </a>
          </div>
          <div className="search-categories" role="tablist" aria-label="Search categories">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={id + '-tab-' + key}
                aria-selected={key === category}
                aria-controls={id + '-panel-' + key}
                tabIndex={key === category ? 0 : -1}
                onClick={() => setCategory(key)}
                onKeyDown={tabKeys}
              >
                {categories[key].title}
              </button>
            ))}
          </div>
          {keys.map((key) => (
            <div
              key={key}
              role="tabpanel"
              id={id + '-panel-' + key}
              aria-labelledby={id + '-tab-' + key}
              hidden={key !== category}
              tabIndex={0}
            >
              {key === category && (
                <CategoryResults category={key} query={query} onProductSelect={onProductSelect} />
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
