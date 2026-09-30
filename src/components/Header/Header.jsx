import { useEffect, useState } from 'react'
import userIcon from '../../assets/discover/figma/2451d.svg'
import heartIcon from '../../assets/discover/figma/0ac49.svg'
import cartIcon from '../../assets/discover/figma/066ed.svg'
import globeIcon from '../../assets/discover/figma/977c7.svg'
import searchIcon from '../../assets/icon-search.svg'
import logoMark from '../../assets/discover/figma/ededd.svg'
import './Header.css'

const navItems = ['Discover', 'Support', 'News']
const actionIcons = [
  { label: 'Account', icon: userIcon },
  { label: 'Wishlist', icon: heartIcon },
  { label: 'Cart', icon: cartIcon },
  { label: 'Language', icon: globeIcon },
]

function Header({
  activeView = 'discover',
  isAuthenticated = false,
  onSignIn,
  onDiscover,
  onSupport,
  onCart,
  onWishlist,
  onAccount,
  onSignOut,
  isLoggingOut = false,
  cartCount = 0,
  wishlistCount = 0,
}) {
  const readQuery = () => new URLSearchParams(window.location.hash.split('?')[1]).get('q') || ''
  const [query, setQuery] = useState(readQuery)
  useEffect(() => {
    const sync = () => setQuery(new URLSearchParams(window.location.hash.split('?')[1]).get('q') || '')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  function search(event) {
    event.preventDefault()
    const value = query.trim()
    window.location.hash = value ? '#/discover?' + new URLSearchParams({ q: value }) : '#/discover?view=catalog'
  }
  function handleActionClick(label) {
    if (label === 'Account') {
      onAccount?.()
    }

    if (label === 'Cart') {
      onCart?.()
    }

    if (label === 'Wishlist') {
      onWishlist?.()
    }
  }

  function handleNavClick(event, item) {
    if (item === 'Discover') {
      event.preventDefault()
      onDiscover?.()
    }

    if (item === 'Support') {
      event.preventDefault()
      onSupport?.()
    }
  }

  return (
    <header className="store-header" aria-label="Store navigation">
      <a className="brand" href="#discover" aria-label="V Store home" onClick={onDiscover}>
        <img className="brand__mark" src={logoMark} alt="" />
        <span className="brand__text">STORE</span>
      </a>

      <div className="header-left">
        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              className={`primary-nav__link${
                activeView === item.toLowerCase() ? ' primary-nav__link--active' : ''
              }`}
              href={`#${item.toLowerCase()}`}
              onClick={(event) => handleNavClick(event, item)}
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>

        <form className="search-field" role="search" aria-label="Search store" onSubmit={search}>
          <button className="search-field__submit" type="submit" aria-label="Search"><img className="search-field__icon" src={searchIcon} alt="" /></button>
          <input className="search-field__input" type="search" aria-label="Search store" placeholder="Search store" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} />
        </form>
      </div>

      <div className="header-actions">
        <div className="icon-actions" aria-label="Quick actions">
          {actionIcons.map(({ label, icon }) => (
            <button
              className={`icon-button${activeView === label.toLowerCase() ? ' icon-button--active' : ''}`}
              type="button"
              aria-label={label}
              aria-describedby={
                label === 'Cart' && cartCount > 0
                  ? 'cart-count'
                  : label === 'Wishlist' && wishlistCount > 0
                    ? 'wishlist-count'
                    : undefined
              }
              onClick={() => handleActionClick(label)}
              key={label}
            >
              <img src={icon} alt="" />
              {label === 'Cart' && cartCount > 0 && <span id="cart-count" className="cart-count" aria-live="polite" aria-label={`${cartCount} items in cart`}>{cartCount}</span>}
              {label === 'Wishlist' && wishlistCount > 0 && <span id="wishlist-count" className="cart-count wishlist-count" aria-live="polite" aria-label={`${wishlistCount} items in wishlist`}>{wishlistCount}</span>}
            </button>
          ))}
        </div>

        {(isAuthenticated || isLoggingOut) && (
          <button className="button button--secondary" type="button" onClick={onSignOut} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        )}
        {!isAuthenticated && !isLoggingOut && (
          <button className="button button--secondary" type="button" onClick={onSignIn}>
            Sign in
          </button>
        )}
        <button className="button button--accent" type="button">
          Download
        </button>
      </div>
    </header>
  )
}

export default Header
