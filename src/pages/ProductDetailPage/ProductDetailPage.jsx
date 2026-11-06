import ProductNews from './ProductNews'
import AchievementsPage from '../AchievementsPage/AchievementsPage'
import WishlistButton from '../../components/Wishlist/WishlistButton'
import AddToCartButton from '../../components/Cart/AddToCartButton'
import useCatalogResource from '../../hooks/useCatalogResource'
import useDocumentTitle, { pageTitle } from '../../hooks/useDocumentTitle'
import MediaGallery, { MediaImage } from '../../components/Catalog/Media'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { productPresentation } from '../../api/product'
import { ProductMarkdown, ExpandableContent, Requirements } from './ProductContent'
import ProductAchievements from './ProductAchievements'
import ProductReviews from './ProductReviews'
import '../../components/Catalog/Catalog.css'
import './ProductDetailPage.css'
import NotFoundPage from '../NotFoundPage/NotFoundPage'

function ProductDetails({ game, onViewAllAchievements, onSignIn }) {
  const presentation = productPresentation(game)
  const primaryTag = game.tags[0]
  const tagHref = (tag) => '#/discover?page=1&tag_id=' + encodeURIComponent(tag.id)
  return (
    <div className="product-detail-page catalog-detail">
      <div className="product-detail-page__inner">
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <a href="#/discover?view=catalog">All Games</a>
          {primaryTag && (
            <>
              <span aria-hidden="true">›</span>
              <a href={tagHref(primaryTag)}>{primaryTag.name}</a>
            </>
          )}
          <span aria-hidden="true">›</span>
          <span aria-current="page">{game.title}</span>
        </nav>
        <div className="product-title-row">
          <h1>{game.title}</h1>
          <a className="product-hub-link" href={`#/games/${game.id}/community`}>
            Community Hub
          </a>
        </div>

        {/* "At a glance": highlight player + 324px information column. */}
        <div className="product-glance">
          <div className="product-glance__media">
            <MediaGallery game={game} />
          </div>
          <aside className="product-sidebar" aria-label="Game information">
            <MediaImage
              className="product-sidebar__cover"
              src={presentation.header}
              alt={game.title}
              eager
            />
            {presentation.summary && (
              <div className="product-sidebar__description">
                <ProductMarkdown imported allowImages={false}>
                  {presentation.summary}
                </ProductMarkdown>
              </div>
            )}
            <dl className="product-meta">
              {presentation.reviewSummary && (
                <div className="product-meta__row">
                  <dt>All Reviews</dt>
                  <dd className="product-review-score">{presentation.reviewSummary.label}</dd>
                </div>
              )}
              {[
                ['Release Date', presentation.releaseDate],
                ['Developer', game.developer],
                ['Publisher', game.publisher],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div className="product-meta__row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            {game.tags.length > 0 && (
              <div className="product-tags-block">
                <span>Popular tags for this product:</span>
                <div className="product-tags">
                  {game.tags.map((tag) => (
                    <a key={tag.id} href={tagHref(tag)}>
                      {tag.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="product-queue" aria-label="Library actions">
          <WishlistButton gameId={game.id} className="product-action product-action--secondary" />
        </div>

        <div className="product-detail-layout">
          <div className="product-main">
            <section className="product-purchase" aria-labelledby="product-purchase-title">
              <h2 id="product-purchase-title">
                {game.is_free ? `Play ${game.title}` : `Buy ${game.title}`}
              </h2>
              <div className="product-purchase__action">
                <div className="detail-price">
                  {game.discount && <span className="detail-price__discount">{game.discount}</span>}
                  <span>
                    {game.originalPrice && <del>{game.originalPrice}</del>}
                    <strong>{game.price}</strong>
                  </span>
                </div>
                <AddToCartButton
                  gameId={game.id}
                  className="product-action product-action--accent"
                />
              </div>
            </section>
            <section className="detail-section about-section">
              <h2>About this game</h2>
              {game.description_md ? (
                <ExpandableContent className="product-about-content" variant="about">
                  <ProductMarkdown imported>{game.description_md}</ProductMarkdown>
                </ExpandableContent>
              ) : (
                <p className="product-empty">No description available yet.</p>
              )}
            </section>
            <Requirements value={game.requirements} />
            {presentation.additional && (
              <section className="detail-section">
                <h2>Additional information</h2>
                <ProductMarkdown>{presentation.additional}</ProductMarkdown>
              </section>
            )}
          </div>
          <aside className="product-side-column" aria-label="Game details">
            {game.rating && (
              <div className="product-rating">
                {presentation.ratingImage ? (
                  <MediaImage src={presentation.ratingImage} alt={game.rating} />
                ) : (
                  <strong className="product-rating__badge">{game.rating}</strong>
                )}
                <div>
                  <strong>{game.rating}</strong>
                  {presentation.ratingDescription && <span>{presentation.ratingDescription}</span>}
                </div>
              </div>
            )}
            <ProductAchievements id={game.id} onViewAll={onViewAllAchievements} />
          </aside>
        </div>
        <ProductNews id={game.id} />
        <ProductReviews onSignIn={onSignIn} id={game.id} isFree={game.is_free} />
        <section className="detail-section product-community-teaser" aria-label="Community">
          <h2>Community</h2>
          <p>Discussions, artwork, reviews and news from players of {game.title}.</p>
          <a className="product-hub-link" href={`#/games/${game.id}/community`}>
            Visit the Community Hub
          </a>
        </section>
      </div>
    </div>
  )
}

export default function ProductDetailPage({
  id,
  showAchievements,
  onViewAllAchievements,
  onSignIn,
}) {
  const resource = useCatalogResource('game', String(id))
  const gameTitle = resource.data?.title
  useDocumentTitle(
    resource.error?.status === 404
      ? pageTitle('Game not found')
      : gameTitle
        ? showAchievements
          ? pageTitle(`${gameTitle} achievements`)
          : `${gameTitle} on VStore`
        : pageTitle(),
  )
  if (resource.error?.status === 404)
    return (
      <NotFoundPage
        title="Game not found"
        description="This game is unavailable or has been removed from the store."
      />
    )
  if (resource.loading || resource.error)
    return (
      <div className="product-detail-page">
        <ResourceStatus resource={resource} label="game" />
        {resource.error && (
          <a className="catalog-back" href="#/discover">
            Back to catalog
          </a>
        )}
      </div>
    )
  const game = resource.data
  if (!game)
    return (
      <div className="catalog-status">
        <h1>Game unavailable</h1>
        <p>This game has no details yet.</p>
        <button type="button" onClick={resource.retry}>
          Retry game
        </button>
        <a href="#/discover">Back to catalog</a>
      </div>
    )
  if (showAchievements) return <AchievementsPage key={game.id} product={game} />
  return (
    <ProductDetails
      onSignIn={onSignIn}
      key={game.id}
      game={game}
      onViewAllAchievements={onViewAllAchievements}
    />
  )
}
