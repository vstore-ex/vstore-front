import { useEffect, useId, useRef, useState } from 'react'
import userIcon from '../../assets/discover/figma/2451d.svg'
import heartIcon from '../../assets/discover/figma/0ac49.svg'
import cartIcon from '../../assets/discover/figma/066ed.svg'
import CurrencySelector from '../../currency/CurrencySelector'
import searchIcon from '../../assets/icon-search.svg'
import logoMark from '../../assets/discover/figma/ededd.svg'
import './Header.css'
import { useWallet } from '../../wallet/context'
import { formatMoney } from '../../api/cart'
import { readStoreLocation } from '../../utils/location'
import NotificationCenter from '../../notifications/NotificationCenter'

const navItems = ['Discover', 'Support', 'News']
const actionIcons = [
  { label: 'Account', icon: userIcon },
  { label: 'Wishlist', icon: heartIcon },
  { label: 'Cart', icon: cartIcon },
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
  const wallet = useWallet()
  const readQuery = () => readStoreLocation().params.get('q') || ''
  const [query, setQuery] = useState(readQuery)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const menuButton = useRef(null)
  const menu = useRef(null)
  const focusedControl = useRef(null)
  useEffect(() => {
    const compact = window.matchMedia?.('(max-width: 680px)')
    if (!compact) return
    const syncLayout = ({ matches }) => {
      // Browsers can blur a newly hidden control before the media-query event.
      const active = document.activeElement
      const focused = active === document.body ? focusedControl.current : active
      // Move focus only when the layout is about to hide its current control.
      if (matches && menu.current?.contains(focused)) menuButton.current?.focus()
      else if (!matches && focused === menuButton.current)
        menu.current?.querySelector('a[href]')?.focus()
      setMenuOpen(false)
    }
    compact.addEventListener('change', syncLayout)
    return () => compact.removeEventListener('change', syncLayout)
  }, [])
  useEffect(() => {
    const sync = () => {
      setQuery(readQuery())
      setMenuOpen(false)
      if (
        menu.current?.contains(document.activeElement) &&
        menuButton.current?.getClientRects().length
      )
        menuButton.current.focus()
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  function search(event) {
    event.preventDefault()
    const value = query.trim()
    closeMenu()
    window.location.assign(
      value ? '#/discover?' + new URLSearchParams({ q: value }) : '#/discover?view=catalog',
    )
  }
  function closeMenu() {
    setMenuOpen(false)
    if (menuButton.current?.getClientRects().length) menuButton.current.focus()
  }
  function handleActionClick(label) {
    closeMenu()
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
    closeMenu()
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
    <header
      className={'store-header' + (isAuthenticated ? ' store-header--signed-in' : '')}
      aria-label="Store navigation"
      onFocusCapture={(event) => {
        focusedControl.current = event.target
      }}
      onBlurCapture={(event) => {
        // Preserve only automatic blur caused by hiding the focused control.
        if (event.relatedTarget || event.target.getClientRects().length)
          focusedControl.current = null
      }}
    >
      <a
        className="brand"
        href="#/discover"
        aria-label="V Store home"
        onClick={(event) => handleNavClick(event, 'Discover')}
      >
        <img className="brand__mark" src={logoMark} alt="" />
        <span className="brand__text">STORE</span>
      </a>
      <button
        ref={menuButton}
        type="button"
        className="header-menu-toggle button button--secondary"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? 'Close menu' : 'Menu'}
      </button>
      <div
        ref={menu}
        id={menuId}
        className={'header-menu' + (menuOpen ? ' header-menu--open' : '')}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented && menuOpen) {
            event.preventDefault()
            setMenuOpen(false)
            menuButton.current?.focus()
          }
        }}
      >
        <div className="header-left">
          <nav className="primary-nav" aria-label="Primary navigation">
            {(isAuthenticated ? [...navItems, 'Messages'] : navItems).map((item) => (
              <a
                className={`primary-nav__link${
                  activeView === item.toLowerCase() ? ' primary-nav__link--active' : ''
                }`}
                href={`#/${item.toLowerCase()}`}
                onClick={(event) => handleNavClick(event, item)}
                key={item}
              >
                {item}
              </a>
            ))}
          </nav>

          <form className="search-field" role="search" aria-label="Search store" onSubmit={search}>
            <button className="search-field__submit" type="submit" aria-label="Search">
              <img className="search-field__icon" src={searchIcon} alt="" />
            </button>
            <input
              className="search-field__input"
              type="search"
              aria-label="Search store"
              placeholder="Search store"
              maxLength={200}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        </div>

        <div className="header-actions">
          {isAuthenticated && (
            <a
              className="header-wallet"
              href="#/wallet"
              aria-label="Open wallet"
              onClick={closeMenu}
            >
              <span>Wallet</span>
              <strong>
                {wallet.error
                  ? 'Unavailable'
                  : wallet.loading
                    ? 'Updating...'
                    : wallet.data
                      ? formatMoney(wallet.data.balance, wallet.data.currency)
                      : 'Loading...'}
              </strong>
              {wallet.data?.is_frozen && <small>Frozen</small>}
            </a>
          )}
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
                {label === 'Cart' && cartCount > 0 && (
                  <span
                    id="cart-count"
                    className="cart-count"
                    aria-live="polite"
                    aria-label={`${cartCount} items in cart`}
                  >
                    {cartCount}
                  </span>
                )}
                {label === 'Wishlist' && wishlistCount > 0 && (
                  <span
                    id="wishlist-count"
                    className="cart-count wishlist-count"
                    aria-live="polite"
                    aria-label={`${wishlistCount} items in wishlist`}
                  >
                    {wishlistCount}
                  </span>
                )}
              </button>
            ))}
            {isAuthenticated && <NotificationCenter />}
            <CurrencySelector />
          </div>

          {(isAuthenticated || isLoggingOut) && (
            <button
              className="button button--secondary"
              type="button"
              onClick={onSignOut}
              disabled={isLoggingOut}
            >
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
      </div>
    </header>
  )
}

export default Header
