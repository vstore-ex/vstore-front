import ProductNews from './ProductNews'
import AchievementsPage from '../AchievementsPage/AchievementsPage'
import WishlistButton from '../../components/Wishlist/WishlistButton'
import AddToCartButton from '../../components/Cart/AddToCartButton'
import useCatalogResource from '../../hooks/useCatalogResource'
import MediaGallery, { MediaImage } from '../../components/Catalog/Media'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { productPresentation } from '../../api/product'
import { ProductMarkdown, ExpandableContent, Requirements } from './ProductContent'
import ProductAchievements from './ProductAchievements'
import ProductReviews from './ProductReviews'
import '../../components/Catalog/Catalog.css'
import './ProductDetailPage.css'

function ProductDetails({ game, onViewAllAchievements, onSignIn }) {
  const presentation = productPresentation(game)
  return <div className="product-detail-page catalog-detail"><div className="product-detail-page__inner">
    <h1>{game.title}</h1>
    <div className="product-detail-layout">
      <div className="product-main">
        <MediaGallery game={game} />
        <section className="detail-section about-section"><h2>About this game</h2>
          {game.description_md ? <ExpandableContent className="product-about-content" limit={655}><ProductMarkdown>{game.description_md}</ProductMarkdown></ExpandableContent>
            : <p className="product-empty">No description available yet.</p>}
        </section>
        <Requirements value={game.requirements} />
        {presentation.additional && <section className="detail-section"><h2>Additional information</h2><ProductMarkdown>{presentation.additional}</ProductMarkdown></section>}
      </div>
      <aside className="product-sidebar" aria-label="Game information">
        <MediaImage className="product-sidebar__cover" src={presentation.header} alt={game.title} eager />
        {presentation.summary && <div className="product-sidebar__description"><ProductMarkdown>{presentation.summary}</ProductMarkdown></div>}
        <dl className="product-meta">
          {presentation.reviewSummary && <div className="product-meta__row"><dt>All Reviews</dt><dd className="product-review-score">{presentation.reviewSummary.label}</dd></div>}
          {[['Release Date', presentation.releaseDate], ['Developer', game.developer], ['Publisher', game.publisher]].filter(([, value]) => value).map(([label, value]) =>
            <div className="product-meta__row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <div className="detail-price">{game.discount && <span className="detail-price__discount">{game.discount}</span>}
          <span>{game.originalPrice && <del>{game.originalPrice}</del>}<strong>{game.price}</strong></span></div>
        <div className="product-actions">
          <AddToCartButton productId={game.id} className="product-action product-action--accent" />
          <WishlistButton productId={game.id} className="product-action product-action--secondary" />
        </div>
        {game.rating && <div className="product-rating">
          {presentation.ratingImage ? <MediaImage src={presentation.ratingImage} alt={game.rating} /> : <strong className="product-rating__badge">{game.rating}</strong>}
          <div><strong>{game.rating}</strong>{presentation.ratingDescription && <span>{presentation.ratingDescription}</span>}</div>
        </div>}
        {game.tags.length > 0 && <div className="product-tags">{game.tags.map(tag => <a key={tag.id} href={'#/discover?page=1&tag_id=' + encodeURIComponent(tag.id)}>{tag.name}</a>)}</div>}
      </aside>
    </div>
    <ProductAchievements id={game.id} onViewAll={onViewAllAchievements} />
    <ProductNews id={game.id} />
    <ProductReviews onSignIn={onSignIn} id={game.id} />
  </div></div>
}

export default function ProductDetailPage({ id, showAchievements, onViewAllAchievements, onSignIn }) {
  const resource = useCatalogResource('game', String(id))
  if (resource.loading || resource.error) return <div className="product-detail-page"><ResourceStatus resource={resource} label="game" />
    {resource.error && <a className="catalog-back" href="#/discover">Back to catalog</a>}</div>
  const game = resource.data
  if (!game) return <div className="catalog-status"><h1>Game unavailable</h1><p>This game has no details yet.</p>
    <button type="button" onClick={resource.retry}>Retry game</button><a href="#/discover">Back to catalog</a></div>
  if (showAchievements) return <AchievementsPage key={game.id} product={game} />
  return <ProductDetails onSignIn={onSignIn} key={game.id} game={game} onViewAllAchievements={onViewAllAchievements} />
}
