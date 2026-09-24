import { useEffect, useRef, useState } from 'react'
import NewsDetailPage from './pages/NewsDetailPage/NewsDetailPage'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import AccountPage from './pages/AccountPage/AccountPage'
import CartPage from './pages/CartPage/CartPage'
import DiscoverPage from './pages/DiscoverPage/DiscoverPage'
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage'
import RegisterPage from './pages/RegisterPage/RegisterPage'
import SupportPage from './pages/SupportPage/SupportPage'
import WishlistPage from './pages/WishlistPage/WishlistPage'
import { useCart } from './cart/context'
import { useWishlist } from './wishlist/context'
import { useAuth } from './auth/context'
import OAuthCallbackPage from './pages/OAuthCallbackPage/OAuthCallbackPage'
import { isOAuthCallback } from './auth/oauth'
import './auth/Auth.css'
import './App.css'


const defaultRoute = { view: 'discover', productId: null }

function parseRouteFromHash() {
  const route = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : window.location.pathname.replace(/^\//, '') + window.location.search
  const [path, query] = route.split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'news') return { view: 'news', productId: parts[1] || null }
  if (parts[0] === 'login') return { view: 'login', productId: null, next: new URLSearchParams(query).get('next') || 'discover' }

  if (!parts.length || parts[0] === 'discover') {
    return defaultRoute
  }

  if (parts[0] === 'products' && parts[1]) {
    return {
      view: parts[2] === 'achievements' ? 'achievements' : 'product',
      productId: parts[1],
    }
  }

  if (['account', 'orders', 'cart', 'wishlist', 'support'].includes(parts[0])) {
    return { view: parts[0], productId: null }
  }

  return defaultRoute
}

function navigateTo(path) {
  const nextHash = `#/${path}`

  if (window.location.hash === nextHash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }

  window.location.hash = nextHash
}

function App() {
  const initialRoute = parseRouteFromHash()
  const [authMode, setAuthMode] = useState(null)
  const { currentUser: user, isAuthenticated, status, error, isLoggingOut, logout, updateUser } = useAuth()
  const completedLogin = useRef(false)
  const [selectedProductId, setSelectedProductId] = useState(initialRoute.productId)
  const [currentView, setCurrentView] = useState(initialRoute.view)
  const [pendingAction, setPendingAction] = useState(null)
  const cart = useCart()
  const wishlist = useWishlist()
  useEffect(() => {
    function syncRoute() {
      const route = parseRouteFromHash()

      setSelectedProductId(route.productId)
      setCurrentView(route.view)
      window.scrollTo({ top: 0 })
    }

    syncRoute()
    window.addEventListener('hashchange', syncRoute)

    return () => {
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading' || status === 'banned' || status === 'error' || isLoggingOut) return
    if (['account', 'orders', 'cart', 'wishlist'].includes(currentView) && !isAuthenticated) {
      navigateTo('login?next=' + currentView)
    }
  }, [status, isLoggingOut, currentView, isAuthenticated])

  useEffect(() => {
    const expired = () => { if (isAuthenticated) navigateTo('login?next=' + currentView) }
    window.addEventListener('vstore:session-expired', expired)
    return () => window.removeEventListener('vstore:session-expired', expired)
  }, [currentView, isAuthenticated])

  function openAuth(mode, action = null) {
    setPendingAction(action)
    setAuthMode(mode)
  }

  function closeAuth() {
    if (currentView === 'login' && !completedLogin.current) navigateTo('discover')
    completedLogin.current = false
    setAuthMode(null)
    setPendingAction(null)
  }

  async function handleAuthenticated() {
    completedLogin.current = true
    const route = parseRouteFromHash()
    if (route.view === 'login') navigateTo(/^(?:account|orders|(?:wishlist|cart)(?:\?add=\d+)?)$/.test(route.next) ? route.next : 'discover')

    if (pendingAction?.type === 'open-cart') {
      openCartPage()
    }

    if (pendingAction?.type === 'open-wishlist') {
      openWishlistPage()
    }

    setPendingAction(null)
  }

  function openProduct(productId) {
    navigateTo(`products/${productId}`)
  }

  function openDiscover() {
    navigateTo('discover')
  }

  function openAccount() {
    navigateTo('account')
  }

  function openSupport() {
    navigateTo('support')
  }

  function openCartPage() {
    navigateTo('cart')
  }

  function openWishlistPage() {
    navigateTo('wishlist')
  }

  function openCart() { openCartPage() }
  function openWishlist() { openWishlistPage() }

  async function signOut(all = false) {
    setAuthMode(null); setPendingAction(null); navigateTo('discover')
    try { await logout(all) } catch { /* The auth context displays the server error. */ }
  }
  if (isOAuthCallback) return <OAuthCallbackPage />
  if (status === 'loading') return <main className="store-page"><p className="store-status" role="status">Loading account...</p></main>
  if (status === 'banned') return <main className="store-page"><section className="store-status" role="alert">
    <h1>Account blocked</h1><p>Your account is blocked. Contact support for assistance.</p>
    <button type="button" disabled={isLoggingOut} onClick={() => signOut()}>Sign out</button>
  </section></main>
  if (status === 'error') return <main className="store-page"><section className="store-status" role="alert">
    <p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry loading account</button>
  </section></main>

  return (
    <main className="store-page">
      <Header
        activeView={currentView}
        isAuthenticated={isAuthenticated}
        onSignIn={() => openAuth('login')}
        onDiscover={openDiscover}
        onSupport={openSupport}
        onCart={openCart}
        onWishlist={openWishlist}
        onAccount={openAccount}
        onSignOut={() => signOut()}
        isLoggingOut={isLoggingOut}
        cartCount={cart.count}
        wishlistCount={wishlist?.count ?? 0}
      />
      {error && <div className="store-status" role="alert">{error}
        {error.startsWith('Could not complete sign out') && <button type="button" disabled={isLoggingOut} onClick={() => signOut()}>Retry sign out</button>}
      </div>}
      {['account', 'orders', 'cart', 'wishlist'].includes(currentView) && !user ? (
        <p className="store-status" role="status">Please sign in to continue.</p>
      ) : ['product', 'achievements'].includes(currentView) ? (
        <ProductDetailPage
          key={selectedProductId}
          id={selectedProductId}
          showAchievements={currentView === 'achievements'}
          onViewAllAchievements={() => navigateTo(`products/${selectedProductId}/achievements`)}
        />
      ) : ['account', 'orders'].includes(currentView) ? (
        <AccountPage user={user} onUpdated={updateUser} onLogoutAll={() => signOut(true)} isLoggingOut={isLoggingOut} />
      ) : currentView === 'cart' ? (
        <CartPage />
      ) : currentView === 'wishlist' ? (
        <WishlistPage />
      ) : currentView === 'news' ? (
        <NewsDetailPage key={selectedProductId || 'news-list'} id={selectedProductId} />
      ) : currentView === 'support' ? (
        <SupportPage />
      ) : (
        <DiscoverPage onProductSelect={openProduct} />
      )}
      <Footer />
      {(authMode || currentView === 'login') && !isLoggingOut && (
        <RegisterPage
          initialMode={authMode || 'login'}
          onClose={closeAuth}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </main>
  )
}

export default App
