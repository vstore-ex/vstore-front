import SearchResults from './SearchResults'
import { useEffect, useId, useState } from 'react'
import { MediaImage } from '../../components/Catalog/Media'
import {
  Carousel,
  GameLink,
  GameRow,
  HeaderCapsule,
  PriceBlock,
  TagList,
} from '../../components/Store/StoreParts'
import { mediaUrl, PAGE_SIZE } from '../../api/catalog'
import useCatalogResource from '../../hooks/useCatalogResource'
import { readStoreLocation } from '../../utils/location'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import StoreGutter from './StoreGutter'
import '../../components/Catalog/Catalog.css'
import mobileLinkIcon from '../../assets/discover/figma/99b90.svg'
import chevronLeft from '../../assets/discover/figma/bbb18.svg'
import './DiscoverPage.css'

function homeGame(game) {
  return { ...game, price: game.release_label || game.price }
}

/**
 * Gallery screenshots for a home preview. Discover lists omit gallery media, so the
 * game's own details are loaded (shared catalog cache); banners are never shown here.
 */
function GameScreenshots({ game, count, className }) {
  const own = game.media.filter((item) => item.media_type === 'image')
  const details = useCatalogResource('game', String(game.id))
  const shots = (
    own.length ? own : (details.data?.media || []).filter((item) => item.media_type === 'image')
  ).slice(0, count)
  if (!shots.length && !details.loading) return null
  return (
    <div className={className}>
      {shots.length
        ? shots.map((item, index) => (
            <MediaImage
              key={item.id ?? item.url}
              src={item.thumbnail_url || item.url}
              alt={`${game.title} screenshot ${index + 1}`}
            />
          ))
        : Array.from({ length: count }, (_, index) => (
            <span key={index} className="store-screenshot-placeholder" aria-hidden="true" />
          ))}
    </div>
  )
}

function featuredSlides(data) {
  const seen = new Set()
  const slides = []
  const add = (game, reason) => {
    if (!game || seen.has(game.id) || slides.length >= 10) return
    seen.add(game.id)
    slides.push({ game: homeGame(game), reason })
  }
  if (data?.featured) add(data.featured, data.featured.featured_subtitle || 'Featured')
  for (const section of data?.sections || [])
    for (const game of section.games) add(game, section.title || 'Recommended')
  return slides
}

function FeaturedCarousel({ data, onSelect }) {
  const slides = featuredSlides(data)
  if (!slides.length) return null
  return (
    <Carousel
      title="Featured & Recommended"
      className="store-featured"
      autoplay={8000}
      itemCount={slides.length}
    >
      {slides.map(({ game, reason }, index) => {
        const hero =
          (index === 0 && mediaUrl(data.featured?.featured_image_url)) || game.mainCapsule
        return (
          <article className="store-featured__slide" key={game.id} aria-label={game.title}>
            <GameLink game={game} onSelect={onSelect} className="store-featured__capsule">
              <MediaImage src={hero} fallbackSrc={game.heroImage} alt={game.title} eager />
            </GameLink>
            <div className="store-featured__info">
              <h3 className="store-featured__title">
                <GameLink game={game} onSelect={onSelect}>
                  {game.title}
                </GameLink>
              </h3>
              <GameScreenshots game={game} count={4} className="store-featured__screens" />
              <div className="store-featured__reason">
                <strong>{reason}</strong>
                <TagList tags={game.tags} limit={4} />
              </div>
              <div className="store-featured__footer">
                <PriceBlock game={game} />
              </div>
            </div>
          </article>
        )
      })}
    </Carousel>
  )
}

function SpecialOffers({ games, onSelect, onViewMore }) {
  if (!games?.length) return null
  return (
    <Carousel
      title="Special Offers"
      className="store-offers"
      itemCount={games.length}
      action={
        <button type="button" className="store-link-button" onClick={onViewMore}>
          Browse more
        </button>
      }
    >
      {games.map((game) => (
        <HeaderCapsule key={game.id} game={homeGame(game)} onSelect={onSelect} ribbon="Deal" />
      ))}
    </Carousel>
  )
}

function UpdatesAndOffers({ promos }) {
  if (!promos?.length) return null
  return (
    <Carousel
      title="Updates & Offers"
      label="Featured updates"
      className="store-updates"
      itemCount={promos.length}
    >
      {promos.map((promo) => {
        const link = mediaUrl(promo.link, window.location.origin)
        const body = (
          <>
            <MediaImage className="store-update__image" src={promo.image_url} alt={promo.title} />
            <span className="store-update__body">
              <strong>{promo.title}</strong>
              {promo.description && <span>{promo.description}</span>}
            </span>
          </>
        )
        return link ? (
          <a className="store-update" href={link} key={promo.id}>
            {body}
          </a>
        ) : (
          <div className="store-update" key={promo.id}>
            {body}
          </div>
        )
      })}
    </Carousel>
  )
}

function FreeToPlay({ games, onSelect, onViewMore }) {
  if (!games?.length) return null
  return (
    <Carousel
      title="Free to Play"
      label="Free games"
      className="store-free"
      itemCount={games.length}
      action={
        <button type="button" className="store-link-button" onClick={onViewMore}>
          View More
        </button>
      }
    >
      {games.map((game) => (
        <HeaderCapsule
          key={game.id}
          game={homeGame(game)}
          onSelect={onSelect}
          ribbon={game.free_soon ? 'Free soon' : 'Free now'}
        />
      ))}
    </Carousel>
  )
}

/** Steam's "New & Trending / Top Sellers / ..." tabbed lists with a hover preview. */
function HomeTabs({ data, onSelect }) {
  const tabs = [
    ...(data?.sections || []).map((section, index) => ({
      id: 'section-' + (section.id ?? index),
      title: section.title || 'Recommended',
      games: section.games,
    })),
    ...(data?.ranked_columns || []).map((column, index) => ({
      id: 'ranked-' + (column.id ?? index),
      title: column.title || 'Top Rated',
      games: column.games,
    })),
  ].filter((tab) => tab.games.length)
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(null)
  const baseId = useId()
  if (!tabs.length) return null
  const tab = tabs[Math.min(active, tabs.length - 1)]
  const games = tab.games.map(homeGame)
  const preview = games.find((game) => game.id === hovered) || games[0]
  return (
    <section className="store-tabs" aria-label="Browse lists">
      <div className="store-tabs__list" role="tablist" aria-label="Game lists">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`${baseId}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={item === tab}
            aria-controls={`${baseId}-panel`}
            onClick={() => {
              setActive(index)
              setHovered(null)
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div
        className="store-tabs__panel"
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tabs.indexOf(tab)}`}
      >
        <div className="store-tabs__rows">
          {games.map((game) => (
            <div
              key={game.id}
              className={'store-tabs__row' + (game.id === preview.id ? ' is-previewed' : '')}
              onMouseEnter={() => setHovered(game.id)}
              onFocus={() => setHovered(game.id)}
            >
              <GameRow game={game} onSelect={onSelect} meta={game.release_label} />
            </div>
          ))}
        </div>
        <aside className="store-tabs__preview" aria-label={`${preview.title} preview`}>
          <h3>{preview.title}</h3>
          <TagList tags={preview.tags} limit={5} />
          <GameScreenshots
            key={preview.id}
            game={preview}
            count={4}
            className="store-tabs__screens"
          />
        </aside>
      </div>
    </section>
  )
}

function MobileBanner({ banner }) {
  if (!banner?.title) return null
  const link = mediaUrl(banner.link, window.location.origin)
  return (
    <section className="mobile-banner" aria-label={banner.title}>
      <MediaImage src={banner.image_url || banner.image} alt={banner.title} />
      <div>
        <h2>{banner.title}</h2>
        <p>{banner.description}</p>
        {link && (
          <a className="discover-action-button" href={link}>
            Install Mobile
            <img src={mobileLinkIcon} alt="" />
          </a>
        )}
      </div>
    </section>
  )
}

function readFilters() {
  const { params } = readStoreLocation()
  const page = Number(params.get('page'))
  const tag = /^\d+$/.test(params.get('tag_id') || '') ? params.get('tag_id') : ''
  return {
    page: Number.isSafeInteger(page) && page > 0 && page < 1000000 ? page : 1,
    tag,
    browse: params.get('view') === 'catalog' || Boolean(tag) || page > 1,
    free: params.get('free') === '1',
  }
}

function DiscoverContent({ onProductSelect }) {
  const [filters, setFilters] = useState(readFilters)
  useEffect(() => {
    const sync = () => setFilters(readFilters())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const query = new URLSearchParams({
    skip: String((filters.page - 1) * PAGE_SIZE),
    limit: String(PAGE_SIZE + 1),
  })
  if (filters.tag) query.set('tag_id', filters.tag)
  const catalog = useCatalogResource('games', query.toString())
  const tags = useCatalogResource('tags')
  const layout = useCatalogResource('discover')
  const data = layout.data
  const sections = data?.sections || []
  const curated = Boolean(
    data?.featured ||
    sections.some((section) => section.games.length) ||
    data?.promos.length ||
    data?.deals.length ||
    data?.free_games.length ||
    data?.ranked_columns.some((column) => column.games.length) ||
    data?.mobile_banner,
  )
  const showCatalog = filters.browse || (!layout.loading && !curated)
  const catalogGames = filters.free ? data?.free_games : catalog.data?.slice(0, PAGE_SIZE)
  function navigate(page = 1, tag = '', free = false) {
    const params = new URLSearchParams({ view: 'catalog', page: String(page) })
    if (tag) params.set('tag_id', tag)
    if (free) params.set('free', '1')
    window.location.hash = '#/discover?' + params
  }
  const visiblePages = Array.from(
    { length: Math.min(filters.page, 5) },
    (_, index) => Math.max(1, filters.page - 4) + index,
  )
  if (catalog.data?.length > PAGE_SIZE) visiblePages.push(filters.page + 1)
  const pagination = !filters.free && (
    <nav className="store-pagination" aria-label="Catalog pages">
      <button
        disabled={filters.page === 1 || catalog.loading}
        onClick={() => navigate(filters.page - 1, filters.tag)}
      >
        <img src={chevronLeft} alt="" />
        Previous
      </button>
      {visiblePages.map((number) => (
        <button
          key={number}
          className={number === filters.page ? 'store-pagination__active' : ''}
          aria-current={number === filters.page ? 'page' : undefined}
          disabled={catalog.loading}
          onClick={() => navigate(number, filters.tag)}
        >
          {number}
        </button>
      ))}
      <button
        disabled={catalog.loading || !catalog.data || catalog.data.length <= PAGE_SIZE}
        onClick={() => navigate(filters.page + 1, filters.tag)}
      >
        Next
        <img className="store-pagination__next" src={chevronLeft} alt="" />
      </button>
    </nav>
  )
  return (
    <div className="discover-page">
      <div className="discover-page__inner">
        <ResourceStatus resource={layout} label="Discover" />
        {!showCatalog && (
          <div className="store-home">
            <StoreGutter tags={tags.data} onBrowse={navigate} />
            <div className="store-home__main">
              <FeaturedCarousel data={data} onSelect={onProductSelect} />
              <SpecialOffers
                games={data?.deals}
                onSelect={onProductSelect}
                onViewMore={() => navigate()}
              />
              <UpdatesAndOffers promos={data?.promos} />
              <FreeToPlay
                games={data?.free_games}
                onSelect={onProductSelect}
                onViewMore={() => navigate(1, '', true)}
              />
              <HomeTabs data={data} onSelect={onProductSelect} />
              <MobileBanner banner={data?.mobile_banner} />
              <section className="store-browse-more" aria-label="Browse more">
                <h2>Looking for something else?</h2>
                <p>Browse the whole catalog or narrow it down by tag.</p>
                <div>
                  <button type="button" onClick={() => navigate()}>
                    All games
                  </button>
                  <button type="button" onClick={() => navigate(1, '', true)}>
                    Free to Play
                  </button>
                  {tags.data?.slice(0, 6).map((tag) => (
                    <button type="button" key={tag.id} onClick={() => navigate(1, String(tag.id))}>
                      {tag.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
        {showCatalog && (
          <section className="discover-catalog" aria-labelledby="catalog-title">
            <div className="discover-catalog__heading">
              <h1 id="catalog-title">{filters.free ? 'Free games' : 'All games'}</h1>
              {filters.browse && (
                <a className="discover-outline-button" href="#/discover">
                  Back to Discover
                </a>
              )}
            </div>
            {!curated && !layout.loading && !layout.error && (
              <p className="catalog-empty">
                Discover is not configured yet. Browse all games below.
              </p>
            )}
            <div className="store-search">
              <div className="store-search__results">
                {!filters.free && <ResourceStatus resource={catalog} label="games" />}
                {catalogGames?.length > 0 && (
                  <div className="store-search__rows">
                    {catalogGames.map((game) => (
                      <GameRow key={game.id} game={homeGame(game)} onSelect={onProductSelect} />
                    ))}
                  </div>
                )}
                {catalogGames?.length === 0 && (
                  <p className="catalog-empty">
                    {filters.tag ? 'No games match this tag.' : 'No games available on this page.'}
                  </p>
                )}
                {pagination}
              </div>
              {!filters.free && (
                <aside className="store-search__filters" aria-label="Narrow by tag">
                  <h2>Narrow by tag</h2>
                  <ResourceStatus resource={tags} label="tags" />
                  <div className="catalog-tags" aria-label="Filter games by tag">
                    <button type="button" aria-pressed={!filters.tag} onClick={() => navigate(1)}>
                      All tags
                    </button>
                    {tags.data?.map((tag) => (
                      <button
                        type="button"
                        key={tag.id}
                        aria-pressed={filters.tag === String(tag.id)}
                        onClick={() => navigate(1, String(tag.id))}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default function DiscoverPage(props) {
  const readQuery = () => (readStoreLocation().params.get('q') || '').trim().slice(0, 200)
  const [query, setQuery] = useState(readQuery)
  useEffect(() => {
    const sync = () => setQuery(readQuery())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return query ? (
    <SearchResults query={query} onProductSelect={props.onProductSelect} />
  ) : (
    <DiscoverContent {...props} />
  )
}
