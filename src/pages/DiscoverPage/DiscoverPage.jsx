import { useEffect, useState } from 'react'
import ProductCard from '../../components/ProductCard/ProductCard'
import { MediaImage } from '../../components/Catalog/Media'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import useCatalogResource from '../../hooks/useCatalogResource'
import { PAGE_SIZE, offerUrl } from '../../api/catalog'
import './DiscoverPage.css'
import '../../components/Catalog/Catalog.css'
function readFilters() {
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const page = Number(query.get('page'))
  return { page: Number.isSafeInteger(page) && page > 0 && page < 1000000 ? page : 1,
    tag: /^\d+$/.test(query.get('tag_id') || '') ? query.get('tag_id') : '' }
}
function GameSection({ title, games = [], onSelect, empty = 'No games in this section yet.' }) {
  return <section className="product-section">{title && <h2>{title}</h2>}
    {games.length ? <div className="product-grid">{games.map(game => <ProductCard key={game.id} product={game} onSelect={onSelect} />)}</div>
      : <p className="catalog-empty">{empty}</p>}
  </section>
}
function Promo({ promo, className = '' }) {
  const href = offerUrl(promo.link)
  const content = <><MediaImage className="promo-card__image" src={promo.image_url || promo.image} alt={promo.title || 'Store offer'} />
    {promo.title && <h2>{promo.title}</h2>}{promo.description && <p>{promo.description}</p>}</>
  return <article className={`promo-card ${className}`}>{href ? <a href={href} aria-label={promo.title || 'View store offer'}>{content}</a> : content}</article>
}
export default function DiscoverPage({ onProductSelect }) {
  const [filters, setFilters] = useState(readFilters)
  useEffect(() => {
    const sync = () => setFilters(readFilters())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const query = new URLSearchParams({ skip: String((filters.page - 1) * PAGE_SIZE), limit: String(PAGE_SIZE + 1) })
  if (filters.tag) query.set('tag_id', filters.tag)
  const catalog = useCatalogResource('games', query.toString())
  const tags = useCatalogResource('tags')
  const layout = useCatalogResource('discover')
  function navigate(page, tag = filters.tag) {
    const query = new URLSearchParams({ page: String(page) })
    if (tag) query.set('tag_id', tag)
    window.location.hash = '#/discover?' + query
  }
  const data = layout.data
  const emptyLayout = data && !data.featured && !data.sections.some(s => s.games.length) && !data.promos.length && !data.deals.length &&
    !data.free_games.length && !data.ranked_columns.some(c => c.games.length) && !data.mobile_banner?.image_url && !data.mobile_banner?.image
  return <div className="discover-page catalog-page"><div className="discover-page__inner">
    <h1>Discover</h1><ResourceStatus resource={layout} label="Discover" />
    {emptyLayout && <p className="catalog-empty">Discover is not configured yet. Browse all games below.</p>}
    {data?.featured && <section className="catalog-featured">
      <MediaImage src={data.featured.heroImage} alt="" eager />
      <div><h2>{data.featured.title}</h2><p>{data.featured.price}</p>
        <a className="button button--accent" href={`#/products/${data.featured.id}`} onClick={e => { e.preventDefault(); onProductSelect(data.featured.id) }}>View game</a></div>
    </section>}
    {data?.sections.map((section, index) => <GameSection key={section.id || index} title={section.title || 'Games'} games={section.games} onSelect={onProductSelect} />)}
    {data && <>
      <section><h2>Offers</h2>{data.promos.length ? <div className="promo-grid">{data.promos.map((promo, index) => <Promo key={promo.id || index} promo={promo} />)}</div> : <p className="catalog-empty">No offers right now.</p>}</section>
      <GameSection title="Deals" games={data.deals} onSelect={onProductSelect} empty="No deals right now." />
      <GameSection title="Free games" games={data.free_games} onSelect={onProductSelect} empty="No free games right now." />
      <div className="catalog-ranked">{data.ranked_columns.map((column, index) => <GameSection key={index} title={column.title || 'Popular games'} games={column.games} onSelect={onProductSelect} />)}</div>
      {(data.mobile_banner?.image_url || data.mobile_banner?.image) && <Promo promo={data.mobile_banner} className="catalog-mobile-banner" />}
    </>}
    <section aria-labelledby="catalog-title"><h2 id="catalog-title">All games</h2>
      <ResourceStatus resource={tags} label="tags" />
      <div className="catalog-tags" aria-label="Filter games by tag">
        <button type="button" aria-pressed={!filters.tag} onClick={() => navigate(1, '')}>All tags</button>
        {tags.data?.map(tag => <button key={tag.id} type="button" aria-pressed={filters.tag === String(tag.id)}
          onClick={() => navigate(1, String(tag.id))}>{tag.name}</button>)}
      </div>
      <ResourceStatus resource={catalog} label="games" />
      {catalog.data && <GameSection games={catalog.data.slice(0, PAGE_SIZE)} onSelect={onProductSelect} empty={filters.tag ? 'No games match this tag.' : 'No games available on this page.'} />}
      <nav className="catalog-pagination" aria-label="Catalog pages">
        <button type="button" disabled={filters.page === 1 || catalog.loading} onClick={() => navigate(filters.page - 1)}>Previous</button>
        <span aria-live="polite">Page {filters.page}</span>
        <button type="button" disabled={catalog.loading || !catalog.data || catalog.data.length <= PAGE_SIZE} onClick={() => navigate(filters.page + 1)}>Next</button>
      </nav>
    </section>
  </div></div>
}
