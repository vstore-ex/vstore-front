import { useMemo, useState } from 'react'
import reviewLikeNegative from '../../assets/review-like-negative.svg'
import reviewLikePositive from '../../assets/review-like-positive.svg'
import './ProductDetailPage.css'

function buildFallbackDetail(product) {
  return {
    logoText: product.title,
    description: `${product.title} is available in the V Store catalog. Add more detail fields in products.js to expand this page.`,
    gallery: [product.image],
    gameplayImage: product.image,
    aboutTitle: `About ${product.title}`,
    about:
      'This product page is generated from shared product data. Screenshots, requirements, reviews, tags, and metadata can be customized per product.',
    meta: [
      ['Release Date', 'Coming soon'],
      ['Developer', 'V Store'],
      ['Publisher', 'V Store'],
    ],
    tags: ['Base Game'],
    requirements: {
      minimum: ['OS: Windows 10', 'Memory: 8 GB RAM', 'Storage: 20 GB available space'],
      recommended: ['OS: Windows 11', 'Memory: 16 GB RAM', 'Storage: 20 GB available space'],
    },
    achievements: ['First launch', 'Collector', 'Explorer'],
    reviews: [],
  }
}

function PriceBlock({ product }) {
  if (product.discount) {
    return (
      <div className="detail-price detail-price--deal">
        <span className="detail-price__discount">{product.discount}</span>
        <span className="detail-price__amounts">
          <span className="detail-price__old">{product.originalPrice}</span>
          <span>{product.price}</span>
        </span>
      </div>
    )
  }

  return <div className="detail-price">{product.price}</div>
}

function ProductGallery({ product, detail }) {
  const [activeImage, setActiveImage] = useState(detail.gallery[0])

  return (
    <section className="product-gallery" aria-label={`${product.title} screenshots`}>
      <img className="product-gallery__hero" src={activeImage} alt="" />

      <div className="product-gallery__thumbs">
        {detail.gallery.map((image, index) => (
          <button
            className={`product-gallery__thumb${image === activeImage ? ' product-gallery__thumb--active' : ''}`}
            type="button"
            onClick={() => setActiveImage(image)}
            aria-label={`Show screenshot ${index + 1}`}
            key={`${image}-${index}`}
          >
            <img src={image} alt="" />
          </button>
        ))}
      </div>
    </section>
  )
}

function ProductSidebar({ product, detail, onAddToCart, onAddToWishlist }) {
  return (
    <aside className="product-sidebar" aria-label={`${product.title} information`}>
      <div className="product-sidebar__logo" aria-label={detail.logoText}>
        {detail.logoText}
      </div>

      <p className="product-sidebar__description">{detail.description}</p>

      <dl className="product-meta">
        {detail.meta.map(([label, value]) => (
          <div className="product-meta__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="product-tags" aria-label="Product tags">
        {detail.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <div className="product-actions">
        <button className="product-action product-action--accent" type="button" onClick={() => onAddToCart?.(product)}>
          Add to cart
        </button>
        <button className="product-action product-action--secondary" type="button" onClick={() => onAddToWishlist?.(product)}>
          Wishlist
        </button>
      </div>

      <PriceBlock product={product} />

      {detail.rating && (
        <div className="product-rating">
          <img src={detail.rating.image} alt="" />
          <div>
            <strong>{detail.rating.age}</strong>
            <span>{detail.rating.notes}</span>
          </div>
        </div>
      )}
    </aside>
  )
}

function Requirements({ requirements }) {
  return (
    <section className="detail-section requirements-section" aria-labelledby="requirements-title">
      <h2 id="requirements-title">System Requirements</h2>
      <div className="requirements-grid">
        {Object.entries(requirements).map(([group, items]) => (
          <div className="requirements-list" key={group}>
            <h3>{group}</h3>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function normalizeAchievement(achievement, index, gallery) {
  if (typeof achievement === 'string') {
    return {
      id: achievement,
      title: achievement,
      description: '',
      completion: Math.max(6, 43 - index * 7),
      icon: gallery[index % gallery.length],
    }
  }

  return {
    icon: gallery[index % gallery.length],
    completion: Math.max(6, 43 - index * 7),
    description: '',
    ...achievement,
  }
}

function Achievements({ achievements, gallery, onViewAllAchievements }) {
  const previewAchievements = achievements
    .slice(0, 5)
    .map((achievement, index) => normalizeAchievement(achievement, index, gallery))

  return (
    <section className="detail-section" aria-labelledby="achievements-title">
      <div className="detail-section__heading-row">
        <h2 id="achievements-title">Achievements</h2>
        <button type="button" onClick={onViewAllAchievements}>
          Show all achievements
        </button>
      </div>
      <div className="achievement-grid">
        {previewAchievements.map((achievement) => (
          <article className="achievement-card" key={achievement.id ?? achievement.title}>
            <img src={achievement.icon} alt="" />
            <h3>{achievement.title}</h3>
            <p>Completed by {achievement.completion}%</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Reviews({ reviews }) {
  if (!reviews.length) {
    return (
      <section className="detail-section reviews-section" aria-labelledby="reviews-title">
        <div className="reviews-header">
          <h2 id="reviews-title">Customer reviews</h2>
          <p>No reviews yet</p>
        </div>
      </section>
    )
  }

  return (
    <section className="detail-section reviews-section" aria-labelledby="reviews-title">
      <div className="reviews-header">
        <h2 id="reviews-title">Customer reviews</h2>
        <p>
          Review score: <strong>Mostly positive</strong>
        </p>
        <div className="reviews-sort">Sort by: Recent</div>
      </div>

      <div className="review-grid">
        {reviews.map((review) => (
          <article
            className={`review-card${review.recommended ? ' review-card--positive' : ' review-card--negative'}`}
            key={review.id}
          >
            <div className="review-card__head">
              <img
                className="review-card__icon"
                src={review.recommended ? reviewLikePositive : reviewLikeNegative}
                alt=""
              />
              <div className="review-card__summary">
                <strong>{review.author}</strong>
                <span>{review.summary}</span>
              </div>
              <time>{review.date}</time>
            </div>

            <div className="review-card__body">
              <p>{review.text}</p>
              <div className="review-card__helpful">
                <span>Was review helpful?</span>
                <button type="button" aria-label={`Mark ${review.author} review as helpful`}>
                  {review.helpful?.yes ?? 0}
                </button>
                <button type="button" aria-label={`Mark ${review.author} review as not helpful`}>
                  {review.helpful?.no ?? 0}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductDetailPage({ product, onAddToCart, onAddToWishlist, onViewAllAchievements }) {
  const detail = useMemo(() => product.detail ?? buildFallbackDetail(product), [product])

  return (
    <div className="product-detail-page">
      <div className="product-detail-page__inner">
        <h1>{detail.pageTitle ?? product.title}</h1>

        <div className="product-detail-layout">
          <ProductGallery product={product} detail={detail} />
          <ProductSidebar
            product={product}
            detail={detail}
            onAddToCart={onAddToCart}
            onAddToWishlist={onAddToWishlist}
          />
        </div>

        <section className="detail-section about-section" aria-labelledby="about-game-title">
          <h2 id="about-game-title">About this game</h2>
          <h3>{detail.aboutTitle}</h3>
          <p>{detail.about}</p>
          <img src={detail.gameplayImage} alt="" />
        </section>

        <Requirements requirements={detail.requirements} />
        <Achievements
          achievements={detail.achievements}
          gallery={detail.gallery}
          onViewAllAchievements={onViewAllAchievements}
        />
        <Reviews reviews={detail.reviews} />
      </div>
    </div>
  )
}

export default ProductDetailPage
