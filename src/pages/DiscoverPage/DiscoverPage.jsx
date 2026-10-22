import SearchResults from './SearchResults'
import { useEffect, useState } from 'react'
import ProductCard from '../../components/ProductCard/ProductCard'
import DiscoverShowcase from '../../components/DiscoverShowcase/DiscoverShowcase'
import { MediaImage } from '../../components/Catalog/Media'
import { mediaUrl, PAGE_SIZE } from '../../api/catalog'
import useCatalogResource from '../../hooks/useCatalogResource'
import { readStoreLocation } from '../../utils/location'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import '../../components/Catalog/Catalog.css'
import giftIcon from '../../assets/discover/figma/97d7f.svg'
import externalLinkIcon from '../../assets/icon-external-link.svg'
import mobileLinkIcon from '../../assets/discover/figma/99b90.svg'
import chevronLeft from '../../assets/discover/figma/bbb18.svg'
import './DiscoverPage.css'

function homeGame(game) {
  return { ...game, price: game.release_label || game.price }
}

function ProductSection({ title, games, onSelect, sale = false, game_overrides = {} }) {
  if (!games?.length) return null
  return (
    <section
      className={'product-section' + (sale ? ' product-section--sale' : '')}
      aria-label={title}
    >
      {title && <h2>{title}</h2>}
      <div className="product-grid">
        {games.map((game) => {
          const product = homeGame(game)
          if (game_overrides[game.id]?.image_url)
            product.image = mediaUrl(game_overrides[game.id].image_url)
          return (
            <ProductCard
              key={game.id}
              product={sale ? product : { ...product, discount: '' }}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    </section>
  )
}

function FeaturedGame({ game, onSelect }) {
  const product = homeGame(game)
  const hero = mediaUrl(game.featured_image_url) || product.heroImage
  const panel = game.banners?.find((banner) => banner.banner_type === 'featured_panel')?.image_url
  const screens = product.media
    .filter((item) => item.media_type === 'image' && item.url !== hero)
    .slice(0, 2)
  return (
    <section
      className={'featured-game' + (game.featured_crop ? ' featured-game--cropped' : '')}
      aria-label={product.title}
    >
      <a
        className="featured-game__hero"
        href={'#/games/' + product.id}
        onClick={(event) => {
          event.preventDefault()
          onSelect(product.id)
        }}
      >
        <MediaImage src={hero} alt={product.title} eager />
      </a>
      <div className="featured-game__panel">
        {panel && <MediaImage className="featured-game__panel-bg" src={panel} alt="" />}
        <div className="featured-game__content">
          <h1>{product.title}</h1>
          {game.featured_subtitle && (
            <p className="featured-game__subtitle">{game.featured_subtitle}</p>
          )}
          <div className="featured-game__screens">
            {screens.map((item, index) => (
              <MediaImage
                key={item.id ?? item.url}
                src={item.url}
                alt={product.title + ' screenshot ' + (index + 1)}
              />
            ))}
          </div>
          <div className="featured-game__footer">
            <span>{product.price}</span>
            <button className="discover-action-button" onClick={() => onSelect(product.id)}>
              Learn more
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function PromoGrid({ promos }) {
  if (!promos?.length) return null
  return (
    <section className="promo-grid" aria-label="Featured updates">
      {promos.map((promo) => {
        const link = mediaUrl(promo.link, window.location.origin)
        return (
          <article className="promo-card" key={promo.id}>
            <MediaImage className="promo-card__image" src={promo.image_url} alt={promo.title} />
            <h2>{promo.title}</h2>
            {promo.description && <p>{promo.description}</p>}
            {link && (
              <a className="discover-shop-button" href={link}>
                See In Shop
                <img src={externalLinkIcon} alt="" />
              </a>
            )}
          </article>
        )
      })}
    </section>
  )
}

function DealStrip({ games, onSelect }) {
  if (!games?.length) return null
  return (
    <section className="deal-strip" aria-label="Deals of the Week">
      {games.map((game) => {
        const product = homeGame(game)
        return (
          <article className="deal-card" key={game.id}>
            <a
              href={'#/games/' + product.id}
              onClick={(event) => {
                event.preventDefault()
                onSelect(product.id)
              }}
            >
              <div className="deal-card__media">
                <MediaImage src={product.heroImage} alt={product.title} />
                <span className="deal-card__ribbon">Deals of the Week</span>
              </div>
              <div className="deal-card__body">
                <h2>{product.title}</h2>
                <div className="deal-card__price">
                  {product.discount && (
                    <>
                      <span>{product.discount}</span>
                      <del>{product.originalPrice}</del>
                    </>
                  )}
                  <strong>{product.price}</strong>
                </div>
              </div>
            </a>
          </article>
        )
      })}
    </section>
  )
}

function FreeGames({ games, onSelect, onViewMore }) {
  if (!games?.length) return null
  return (
    <section className="free-games" aria-labelledby="free-games-title">
      <div className="free-games__inner">
        <div className="free-games__header">
          <h2 id="free-games-title">
            <img className="free-games__icon" src={giftIcon} alt="" />
            Free games!
          </h2>
          <button className="discover-outline-button" onClick={onViewMore}>
            View More
          </button>
        </div>
        <div className="free-games__grid">
          {games.map((game) => {
            const product = homeGame(game)
            return (
              <article className="free-game-card" key={game.id}>
                <a
                  href={'#/games/' + product.id}
                  onClick={(event) => {
                    event.preventDefault()
                    onSelect(product.id)
                  }}
                >
                  <div className="free-game-card__media">
                    <MediaImage src={product.heroImage} alt={product.title} />
                    <span
                      className={
                        'free-game-card__ribbon' + (game.free_soon ? ' free-game-card__soon' : '')
                      }
                    >
                      {game.free_soon ? 'FREE SOON' : 'FREE NOW'}
                    </span>
                  </div>
                  <h3>{product.title}</h3>
                  {game.availability && <p>{game.availability}</p>}
                </a>
              </article>
            )
          })}
        </div>
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
  const columns = (data?.ranked_columns || []).map((column, index) => ({
    ...column,
    id: column.id || 'ranked-' + index,
    items: column.games.map((game) => {
      const product = homeGame(game)
      const image = column.game_overrides?.[game.id]?.image_url
      return image ? { ...product, image: mediaUrl(image) } : product
    }),
  }))
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
  return (
    <div className="discover-page">
      <div className="discover-page__inner">
        <ResourceStatus resource={layout} label="Discover" />
        {!filters.browse && (
          <>
            {data?.featured && <FeaturedGame game={data.featured} onSelect={onProductSelect} />}
            <ProductSection {...sections[0]} onSelect={onProductSelect} />
            <PromoGrid promos={data?.promos} />
            <ProductSection {...sections[1]} sale onSelect={onProductSelect} />
            <DealStrip games={data?.deals} onSelect={onProductSelect} />
            <FreeGames
              games={data?.free_games}
              onSelect={onProductSelect}
              onViewMore={() => navigate(1, '', true)}
            />
            <MobileBanner banner={data?.mobile_banner} />
            {columns.length > 0 && (
              <DiscoverShowcase columns={columns} onItemSelect={onProductSelect} />
            )}
            {sections.slice(2).map((section, index) => (
              <ProductSection key={section.id || index} {...section} onSelect={onProductSelect} />
            ))}
          </>
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
            {!filters.free && (
              <>
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
                <ResourceStatus resource={catalog} label="games" />
              </>
            )}
            <ProductSection games={catalogGames} onSelect={onProductSelect} />
            {catalogGames?.length === 0 && (
              <p className="catalog-empty">
                {filters.tag ? 'No games match this tag.' : 'No games available on this page.'}
              </p>
            )}
          </section>
        )}
        {!filters.free && (
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
            {!showCatalog && (
              <button className="store-pagination__browse" onClick={() => navigate()}>
                All games
              </button>
            )}
          </nav>
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
