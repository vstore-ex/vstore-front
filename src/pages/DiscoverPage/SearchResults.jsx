import useCatalogResource from '../../hooks/useCatalogResource'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
export default function SearchResults({ query, onProductSelect }) {
  const resource = useCatalogResource('search', query)
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
          <ResourceStatus resource={resource} label="search results" />
          {resource.data && (
            <p role="status">
              {resource.data.length
                ? resource.data.length + ' matching games'
                : 'No games found. Try another title, developer or publisher.'}
            </p>
          )}
          <div className="search-results">
            {resource.data?.map((game) => (
              <a
                className="search-result"
                key={game.id}
                href={'#/games/' + encodeURIComponent(game.id)}
                onClick={(event) => {
                  if (
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    onProductSelect
                  ) {
                    event.preventDefault()
                    onProductSelect(game.id)
                  }
                }}
              >
                <MediaImage src={game.headerImage || game.image} alt="" />
                <div>
                  <h2>{game.title}</h2>
                  {game.developer && <p>{game.developer}</p>}
                  <span>
                    {game.originalPrice && <del>{game.originalPrice} </del>}
                    {game.price}
                  </span>
                </div>
              </a>
            ))}
          </div>
          {resource.data?.length >= 20 && (
            <p className="catalog-empty">
              Showing the top matches. Refine your search for more specific results.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
