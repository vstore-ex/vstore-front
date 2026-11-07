import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useCart } from '../../cart/context'
import { useWallet } from '../../wallet/context'
import { useWishlist } from '../../wishlist/context'
import { formatMoney } from '../../api/cart'
import './StoreGutter.css'

/** Store home left column: your store, wallet, browsing and popular tags. */

const VISIBLE_TAGS = 8

const ICONS = {
  home: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  wishlist: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  library: (
    <>
      <path d="M5 4h4v16H5zM10 4h4v16h-4z" />
      <path d="M15.5 5.2l3.8-1 3.1 15.6-3.8 1z" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  news: (
    <>
      <path d="M5 5h11v14H7a2 2 0 0 1-2-2z" />
      <path d="M16 9h3v8a2 2 0 0 1-2 2M8 9h5M8 12h5M8 15h3" />
    </>
  ),
  games: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  free: (
    <>
      <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13" />
      <path d="M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1z" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  )
}

function GutterLink({ href, icon, label, count, current, onClick }) {
  const name = count > 0 ? `${label}, ${count} items` : undefined
  const content = (
    <>
      <Icon name={icon} />
      <span className="store-gutter__label">{label}</span>
      {count > 0 && (
        <span className="store-gutter__count" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </>
  )
  return href ? (
    <a
      className="store-gutter__item"
      href={href}
      aria-label={name}
      aria-current={current ? 'page' : undefined}
    >
      {content}
    </a>
  ) : (
    <button type="button" className="store-gutter__item" onClick={onClick}>
      {content}
    </button>
  )
}

export default function StoreGutter({ tags: tagData, onBrowse }) {
  // Tags are null while loading or on error; the default parameter only covers undefined.
  const tags = Array.isArray(tagData) ? tagData : []
  const auth = useAuth()
  const wallet = useWallet()
  const wishlist = useWishlist()
  const cart = useCart()
  const [allTags, setAllTags] = useState(false)
  const signedIn = !!auth?.isAuthenticated
  const visibleTags = allTags ? tags : tags.slice(0, VISIBLE_TAGS)
  const balance = wallet?.data ? formatMoney(wallet.data.balance, wallet.data.currency) : null
  return (
    <aside className="store-gutter" aria-label="Store navigation">
      <nav className="store-gutter__group" aria-labelledby="gutter-store">
        <h2 id="gutter-store">Your store</h2>
        <GutterLink href="#/discover" icon="home" label="Home" current />
        {signedIn ? (
          <>
            <GutterLink
              href="#/wishlist"
              icon="wishlist"
              label="Wishlist"
              count={wishlist?.count ?? 0}
            />
            <GutterLink href="#/library" icon="library" label="Library" />
            <GutterLink href="#/cart" icon="cart" label="Cart" count={cart?.count ?? 0} />
          </>
        ) : (
          <p className="store-gutter__note">
            Sign in to keep a wishlist, see your library and check out.
          </p>
        )}
        <GutterLink href="#/news" icon="news" label="News" />
      </nav>

      {signedIn && (
        <section className="store-gutter__wallet" aria-labelledby="gutter-wallet">
          <h2 id="gutter-wallet">Wallet</h2>
          <p className="store-gutter__balance">
            {wallet?.error
              ? 'Balance unavailable'
              : (balance ?? (wallet?.loading ? 'Loading…' : '—'))}
          </p>
          <a className="store-gutter__add-funds" href="#/wallet">
            Add funds
          </a>
        </section>
      )}

      <nav className="store-gutter__group" aria-labelledby="gutter-browse">
        <h2 id="gutter-browse">Browse</h2>
        <GutterLink icon="games" label="All games" onClick={() => onBrowse()} />
        <GutterLink icon="free" label="Free to play" onClick={() => onBrowse(1, '', true)} />
      </nav>

      {tags.length > 0 && (
        <nav className="store-gutter__group" aria-labelledby="gutter-tags">
          <h2 id="gutter-tags">Popular tags</h2>
          <ul className="store-gutter__tags">
            {visibleTags.map((tag) => (
              <li key={tag.id}>
                <button type="button" onClick={() => onBrowse(1, String(tag.id))}>
                  {tag.name}
                </button>
              </li>
            ))}
          </ul>
          {tags.length > VISIBLE_TAGS && (
            <button
              type="button"
              className="store-gutter__more"
              aria-expanded={allTags}
              onClick={() => setAllTags((value) => !value)}
            >
              {allTags ? 'Show fewer tags' : `Show all ${tags.length} tags`}
            </button>
          )}
        </nav>
      )}
    </aside>
  )
}
