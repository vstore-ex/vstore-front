import { useEffect, useState } from 'react'
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
import './App.css'

const AUTH_STORAGE_KEY = 'vstore:isAuthenticated'
const CART_STORAGE_KEY = 'vstore:cartProductIds'
const WISHLIST_STORAGE_KEY = 'vstore:wishlistProductIds'

const defaultRoute = { view: 'discover', productId: null }

function parseRouteFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
  const parts = hash.split('/').filter(Boolean)

  if (!parts.length || parts[0] === 'discover') {
    return defaultRoute
  }

  if (parts[0] === 'products' && parts[1]) {
    return {
      view: parts[2] === 'achievements' ? 'achievements' : 'product',
      productId: parts[1],
    }
  }

  if (['account', 'cart', 'wishlist', 'support'].includes(parts[0])) {
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

function getInitialAuthState() {
  return localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
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
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState)
  const [selectedProductId, setSelectedProductId] = useState(initialRoute.productId)
  const [currentView, setCurrentView] = useState(initialRoute.view)
  const [pendingAction, setPendingAction] = useState(null)
  const [cartProductIds, setCartProductIds] = useState(getInitialCartProductIds)
  const [wishlistProductIds, setWishlistProductIds] = useState(getInitialWishlistProductIds)

  const selectedProduct = selectedProductId ? getProductById(selectedProductId) : null
  const cartItems = buildCartItems(cartProductIds)
  const wishlistItems = buildWishlistItems(wishlistProductIds)

  useEffect(() => {
    localStorage.setItem(AUTH_STORAGE_KEY, String(isAuthenticated))
  }, [isAuthenticated])

  useEffect(() => {
    function syncRoute() {
      const route = parseRouteFromHash()
      const routeProduct = route.productId ? getProductById(route.productId) : null

      if (route.productId && !routeProduct) {
        navigateTo('discover')
        return
      }

      if (['account', 'cart', 'wishlist'].includes(route.view) && !isAuthenticated) {
        const actionByView = {
          account: null,
          cart: { type: 'open-cart' },
          wishlist: { type: 'open-wishlist' },
        }

        setSelectedProductId(null)
        setCurrentView('discover')
        openAuth('login', actionByView[route.view])
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
  }, [isAuthenticated])

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
    setAuthMode(null)
    setPendingAction(null)
  }

  function handleAuthenticated() {
    setIsAuthenticated(true)

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

  function openCart() {
    if (!isAuthenticated) {
      openAuth('login', { type: 'open-cart' })
      return
    }

    openCartPage()
  }

  function openWishlist() {
    if (!isAuthenticated) {
      openAuth('login', { type: 'open-wishlist' })
      return
    }

    openWishlistPage()
  }

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
      />
      {selectedProduct && currentView === 'achievements' ? (
        <AchievementsPage product={selectedProduct} />
      ) : selectedProduct ? (
        <ProductDetailPage
          product={selectedProduct}
          onAddToCart={handleAddToCart}
          onAddToWishlist={handleAddToWishlist}
          onViewAllAchievements={openAchievements}
        />
      ) : currentView === 'account' ? (
        <AccountPage />
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
      {authMode && (
        <RegisterPage
          initialMode={authMode}
          onClose={closeAuth}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </main>
  )
}

export default App
