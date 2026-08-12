import userIcon from '../../assets/icon-user-circle.svg'
import heartIcon from '../../assets/icon-heart.svg'
import cartIcon from '../../assets/icon-cart.svg'
import globeIcon from '../../assets/icon-globe.svg'
import searchIcon from '../../assets/icon-search.svg'
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
}) {
  function handleActionClick(label) {
    if (label === 'Account') {
      if (isAuthenticated) {
        onAccount?.()
      } else {
        onSignIn?.()
      }
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

        <label className="search-field" aria-label="Search store">
          <img className="search-field__icon" src={searchIcon} alt="" />
          <input className="search-field__input" type="search" placeholder="Search store" />
        </label>
      </div>

      <div className="header-actions">
        <div className="icon-actions" aria-label="Quick actions">
          {actionIcons.map(({ label, icon }) => (
            <button
              className={`icon-button${activeView === label.toLowerCase() ? ' icon-button--active' : ''}`}
              type="button"
              aria-label={label}
              onClick={() => handleActionClick(label)}
              key={label}
            >
              <img src={icon} alt="" />
            </button>
          ))}
        </div>

        {!isAuthenticated && (
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
