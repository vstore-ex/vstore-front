import { useEffect, useRef, useState } from 'react'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import AccountPage from './pages/AccountPage/AccountPage'
import AchievementsPage from './pages/AchievementsPage/AchievementsPage'
import CartPage from './pages/CartPage/CartPage'
import DiscoverPage from './pages/DiscoverPage/DiscoverPage'
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage'
import RegisterPage from './pages/RegisterPage/RegisterPage'
import SupportPage from './pages/SupportPage/SupportPage'
import WishlistPage from './pages/WishlistPage/WishlistPage'
import { buildCartItems, defaultCartProductIds } from './data/cart'
import { getProductById } from './data/products'
import { buildWishlistItems, defaultWishlistProductIds } from './data/wishlist'
import { useAuth } from './auth/context'
import './auth/Auth.css'
import './App.css'

const CART_STORAGE_KEY = 'vstore:cartProductIds'
const WISHLIST_STORAGE_KEY = 'vstore:wishlistProductIds'

const defaultRoute = { view: 'discover', productId: null }

function parseRouteFromHash() {
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
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

function getInitialCartProductIds() {
  try {
    const storedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY))

    if (Array.isArray(storedCart)) {
      return storedCart
    }
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY)
  }

  return defaultCartProductIds
}

function getInitialWishlistProductIds() {
  try {
    const storedWishlist = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY))

    if (Array.isArray(storedWishlist)) {
      return storedWishlist
    }
  } catch {
    localStorage.removeItem(WISHLIST_STORAGE_KEY)
  }

  return defaultWishlistProductIds
}

function App() {
  const initialRoute = parseRouteFromHash()
  const [authMode, setAuthMode] = useState(null)
  const { currentUser: user, isAuthenticated, status, error, isLoggingOut, logout, updateUser } = useAuth()
  const completedLogin = useRef(false)
  const [selectedProductId, setSelectedProductId] = useState(initialRoute.productId)
  const [currentView, setCurrentView] = useState(initialRoute.view)
  const [pendingAction, setPendingAction] = useState(null)
  const [cartProductIds, setCartProductIds] = useState(getInitialCartProductIds)
  const [wishlistProductIds, setWishlistProductIds] = useState(getInitialWishlistProductIds)

  const selectedProduct = selectedProductId ? getProductById(selectedProductId) : null
  const cartItems = buildCartItems(cartProductIds)
  const wishlistItems = buildWishlistItems(wishlistProductIds)

  useEffect(() => {
    function syncRoute() {
      const route = parseRouteFromHash()
      const routeProduct = route.productId ? getProductById(route.productId) : null

      if (route.productId && !routeProduct) {
        navigateTo('discover')
        return
      }

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

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartProductIds))
  }, [cartProductIds])

  useEffect(() => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistProductIds))
  }, [wishlistProductIds])

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
    if (route.view === 'login') navigateTo(['account', 'orders', 'cart', 'wishlist'].includes(route.next) ? route.next : 'discover')

    if (pendingAction?.type === 'open-cart') {
      openCartPage()
    }

    if (pendingAction?.type === 'open-wishlist') {
      openWishlistPage()
    }

    if (pendingAction?.type === 'add-to-cart') {
      addProductToCart(pendingAction.productId)
      openCartPage()
    }

    if (pendingAction?.type === 'add-to-wishlist') {
      addProductToWishlist(pendingAction.productId)
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

  function openAchievements() {
    if (selectedProductId) {
      navigateTo(`products/${selectedProductId}/achievements`)
    }
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

  function addProductToCart(productId) {
    setCartProductIds((currentIds) =>
      currentIds.includes(productId) ? currentIds : [...currentIds, productId],
    )
  }

  function addProductToWishlist(productId) {
    setWishlistProductIds((currentIds) =>
      currentIds.includes(productId) ? currentIds : [...currentIds, productId],
    )
  }

  function handleAddToCart(product) {
    if (!isAuthenticated) {
      openAuth('login', { type: 'add-to-cart', productId: product.id })
      return
    }

    addProductToCart(product.id)
    openCartPage()
  }

  function handleAddToWishlist(product) {
    if (!isAuthenticated) {
      openAuth('login', { type: 'add-to-wishlist', productId: product.id })
      return
    }

    addProductToWishlist(product.id)
    openWishlistPage()
  }

  function removeCartItem(productId) {
    setCartProductIds((currentIds) => currentIds.filter((id) => id !== productId))
  }

  function moveCartItemToWishlist(productId) {
    addProductToWishlist(productId)
    removeCartItem(productId)
  }

  function removeWishlistItem(productId) {
    setWishlistProductIds((currentIds) => currentIds.filter((id) => id !== productId))
  }

  function moveWishlistItemToCart(productId) {
    addProductToCart(productId)
    removeWishlistItem(productId)
    openCartPage()
  }

  function handleCheckout() {
    setCartProductIds([])
  }

  async function signOut(all = false) {
    setAuthMode(null); setPendingAction(null); navigateTo('discover')
    try { await logout(all) } catch { /* The auth context displays the server error. */ }
  }
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
      />
      {error && <div className="store-status" role="alert">{error}
        {error.startsWith('Could not complete sign out') && <button type="button" disabled={isLoggingOut} onClick={() => signOut()}>Retry sign out</button>}
      </div>}
      {['account', 'orders', 'cart', 'wishlist'].includes(currentView) && !user ? <p className="store-status" role="status">Please sign in to continue.</p> : selectedProduct && currentView === 'achievements' ? (
        <AchievementsPage product={selectedProduct} />
      ) : selectedProduct ? (
        <ProductDetailPage
          product={selectedProduct}
          onAddToCart={handleAddToCart}
          onAddToWishlist={handleAddToWishlist}
          onViewAllAchievements={openAchievements}
        />
      ) : ['account', 'orders'].includes(currentView) ? (
        <AccountPage user={user} onUpdated={updateUser} onLogoutAll={() => signOut(true)} isLoggingOut={isLoggingOut} />
      ) : currentView === 'cart' ? (
        <CartPage
          items={cartItems}
          onCheckout={handleCheckout}
          onMoveToWishlist={moveCartItemToWishlist}
          onRemove={removeCartItem}
        />
      ) : currentView === 'wishlist' ? (
        <WishlistPage
          items={wishlistItems}
          onAddToCart={moveWishlistItemToCart}
          onRemove={removeWishlistItem}
        />
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
