import userIcon from '../../assets/icon-user-circle.svg'
import heartIcon from '../../assets/icon-heart.svg'
import cartIcon from '../../assets/icon-cart.svg'
import globeIcon from '../../assets/icon-globe.svg'
import StoreSearch from './StoreSearch'
import logoMark from '../../assets/logo-mark.svg'
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

        <StoreSearch />
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
