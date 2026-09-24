import AchievementsPage from '../AchievementsPage/AchievementsPage'
import WishlistButton from '../../components/Wishlist/WishlistButton'
import AddToCartButton from '../../components/Cart/AddToCartButton'
import useCatalogResource from '../../hooks/useCatalogResource'
import MediaGallery, { MediaImage } from '../../components/Catalog/Media'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import './ProductDetailPage.css'
import '../../components/Catalog/Catalog.css'
export default function ProductDetailPage({ id, showAchievements, onViewAllAchievements }) {
  const resource = useCatalogResource('game', String(id))
  if (resource.loading || resource.error) return <div className="product-detail-page"><ResourceStatus resource={resource} label="game" />
    {resource.error && <a className="catalog-back" href="#/discover">Back to catalog</a>}</div>
  const game = resource.data
  if (!game) return <div className="catalog-status"><h1>Game unavailable</h1><p>This game has no details yet.</p>
    <button type="button" onClick={resource.retry}>Retry game</button><a href="#/discover">Back to catalog</a></div>
  if (showAchievements) return <AchievementsPage product={game} />
  return <div className="product-detail-page catalog-detail"><div className="product-detail-page__inner">
    <h1>{game.title}</h1><div className="product-detail-layout">
      <MediaGallery key={game.id} game={game} />
      <aside className="product-sidebar">
        <MediaImage className="catalog-cover" src={game.image} alt={game.title} />
        <dl className="product-meta">{[['Developer', game.developer], ['Publisher', game.publisher], ['Rating', game.rating]].filter(([, value]) => value).map(([label, value]) =>
          <div className="product-meta__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <div className="product-tags">{game.tags.map(tag => <a key={tag.id} href={`#/discover?page=1&tag_id=${encodeURIComponent(tag.id)}`}>{tag.name}</a>)}</div>
        <p className="catalog-price">{game.originalPrice && <del>{game.originalPrice} </del>}{game.price}</p>
        <div className="product-actions">
          <AddToCartButton productId={game.id} className="product-action product-action--accent" />
          <WishlistButton productId={game.id} className="product-action product-action--secondary" />
        </div>
      </aside>
    </div>
    <section className="detail-section"><h2>About this game</h2><p className="catalog-description">{game.description_md || 'No description available yet.'}</p></section>
    {game.requirements && <section className="detail-section"><h2>System requirements</h2><p className="catalog-description">{game.requirements}</p></section>}
    <section className="detail-section"><h2>Achievements</h2><button className="button button--secondary" onClick={onViewAllAchievements}>Show all achievements</button></section>
    {game.meta_info && <section className="detail-section"><h2>Additional information</h2><p className="catalog-description">{game.meta_info}</p></section>}
  </div></div>
}
