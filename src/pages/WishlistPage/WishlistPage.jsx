import { useEffect, useState } from 'react'
import iconMac from '../../assets/cart/icon-mac.svg'
import iconWindows from '../../assets/cart/icon-windows.svg'
import './WishlistPage.css'

const WISHLIST_NOTIFICATIONS_KEY = 'vstore:wishlistNotifications'

function getInitialNotificationsState() {
  return localStorage.getItem(WISHLIST_NOTIFICATIONS_KEY) === 'true'
}

function parsePrice(price) {
  if (!price || price.toLowerCase() === 'free') {
    return 0
  }

  return Number(price.replace(/[^\d.]/g, '')) || 0
}

function formatPrice(value) {
  return `UAH ${value.toFixed(2)}`
}

function getReleaseDate(item) {
  return item.detail?.meta?.find(([label]) => label.toLowerCase() === 'release date')?.[1] ?? '20.05.2025'
}

function WishlistNotice() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(getInitialNotificationsState)

  useEffect(() => {
    localStorage.setItem(WISHLIST_NOTIFICATIONS_KEY, String(notificationsEnabled))
  }, [notificationsEnabled])

  return (
    <section className="wishlist-notice" aria-label="Wishlist notifications">
      <div className="wishlist-notice__mark" aria-hidden="true">
        !
      </div>
      <div className="wishlist-notice__content">
        <span className="wishlist-notice__mail" aria-hidden="true" />
        <p>Get notified when your wishlisted games go on sale, or are available for purchase or pre-purchase.</p>
      </div>
      <button
        className={`wishlist-notice__toggle${
          notificationsEnabled ? ' wishlist-notice__toggle--active' : ''
        }`}
        type="button"
        aria-label="Toggle wishlist sale notifications"
        aria-pressed={notificationsEnabled}
        onClick={() => setNotificationsEnabled((currentValue) => !currentValue)}
      >
        <span className="wishlist-notice__toggle-track">
          <span className="wishlist-notice__toggle-thumb" />
          <span className="wishlist-notice__toggle-label">{notificationsEnabled ? 'ON' : 'OFF'}</span>
        </span>
      </button>
    </section>
  )
}

function WishlistItem({ item, onAddToCart, onRemove }) {
  return (
    <article className="wishlist-item">
      <div className="wishlist-item__main">
        <img className="wishlist-item__cover" src={item.image} alt="" />

        <div className="wishlist-item__info">
          <span className="wishlist-item__type">{item.type}</span>
          <h2>{item.title}</h2>

          <dl className="wishlist-item__meta">
            <div>
              <dt>All Reviews:</dt>
              <dd className="wishlist-item__review">Mostly Positive</dd>
            </div>
            <div>
              <dt>Release Date</dt>
              <dd>{getReleaseDate(item)}</dd>
            </div>
          </dl>

          <div className="wishlist-item__platforms" aria-label="Available platforms">
            <img src={iconWindows} alt="Windows" />
            <img src={iconMac} alt="Mac" />
          </div>
        </div>
      </div>

      <div className="wishlist-item__side">
        <strong>{formatPrice(parsePrice(item.price))}</strong>
        <div className="wishlist-item__actions">
          <button className="wishlist-item__remove" type="button" onClick={() => onRemove(item.id)}>
            Remove
          </button>
          <button className="wishlist-item__cart" type="button" onClick={() => onAddToCart(item.id)}>
            Add To Cart
          </button>
        </div>
      </div>
    </article>
  )
}

function WishlistPage({ items, onAddToCart, onRemove }) {
  const total = items.reduce((sum, item) => sum + parsePrice(item.price), 0)

  return (
    <div className="wishlist-page">
      <div className="wishlist-page__inner">
        <div className="wishlist-page__header">
          <h1>My Wishlist</h1>
          <span>{formatPrice(total)}</span>
        </div>

        <WishlistNotice />

        <div className="wishlist-sort">
          <span>Sort by:</span>
          <button type="button">
            On Sale
            <span aria-hidden="true" />
          </button>
        </div>

        {items.length > 0 ? (
          <section className="wishlist-list" aria-label="Wishlist items">
            {items.map((item) => (
              <WishlistItem item={item} onAddToCart={onAddToCart} onRemove={onRemove} key={item.id} />
            ))}
          </section>
        ) : (
          <section className="wishlist-empty" aria-label="Empty wishlist">
            <h2>Your wishlist is empty</h2>
            <p>Add games from product pages and they will appear here.</p>
          </section>
        )}
      </div>
    </div>
  )
}

export default WishlistPage
