import UserProfilePage from './pages/UserProfilePage/UserProfilePage'
import NewsPage from './pages/NewsPage/NewsPage'
import NotificationsPage from './pages/NotificationsPage/NotificationsPage'
import NewsDetailPage from './pages/NewsDetailPage/NewsDetailPage'
import { useEffect, useRef, useState } from 'react'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import AccountPage from './pages/AccountPage/AccountPage'
import CartPage from './pages/CartPage/CartPage'
import DiscoverPage from './pages/DiscoverPage/DiscoverPage'
import ProductDetailPage from './pages/ProductDetailPage/ProductDetailPage'
import RegisterPage from './pages/RegisterPage/RegisterPage'
import PasswordResetRequestPage from './pages/PasswordResetRequestPage/PasswordResetRequestPage'
import SupportPage from './pages/SupportPage/SupportPage'
import WishlistPage from './pages/WishlistPage/WishlistPage'
import { useCart } from './cart/context'
import { useWishlist } from './wishlist/context'
import { useAuth } from './auth/context'
import OAuthCallbackPage from './pages/OAuthCallbackPage/OAuthCallbackPage'
import { isOAuthCallback } from './auth/oauth'
import { readStoreLocation } from './utils/location'
import './auth/Auth.css'
import './App.css'

const defaultRoute = { view: 'discover', gameId: null }

function parseRouteFromHash() {
  const { path, params } = readStoreLocation()
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'login')
    return {
      view: 'login',
      gameId: null,
      next: params.get('next') || 'discover',
    }

  if (parts[0] === 'forgot-password') return { view: 'forgotPassword', gameId: null }

  if (!parts.length || parts[0] === 'discover') {
    return defaultRoute
  }

  if (parts[0] === 'users' && parts[1])
    return { view: 'userProfile', userId: parts[1], gameId: null }

  if (parts[0] === 'news')
    return { view: parts[1] ? 'newsDetail' : 'news', newsId: parts[1], gameId: null }

  if (
    (parts[0] === 'games' || (parts[0] === 'products' && parts[2] === 'achievements')) &&
    parts[1]
  ) {
    return {
      view: parts[2] === 'achievements' ? 'achievements' : 'product',
      gameId: parts[1],
    }
  }

  if (
    ['account', 'wallet', 'orders', 'cart', 'wishlist', 'support', 'notifications'].includes(
      parts[0],
    )
  ) {
    const add = ['cart', 'wishlist'].includes(parts[0]) ? params.get('add')?.trim() : null
    return {
      view: parts[0],
      gameId: null,
      next: parts[0] + (add ? '?' + new URLSearchParams({ add }) : ''),
    }
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
  const [authNotice, setAuthNotice] = useState('')
  const {
    currentUser: user,
    isAuthenticated,
    status,
    error,
    isLoggingOut,
    logout,
    updateUser,
  } = useAuth()
  const completedLogin = useRef(false)
  const [selectedGameId, setSelectedGameId] = useState(initialRoute.gameId)
  const [selectedUserId, setSelectedUserId] = useState(initialRoute.userId)
  const [selectedNewsId, setSelectedNewsId] = useState(initialRoute.newsId)
  const [currentView, setCurrentView] = useState(initialRoute.view)
  const [pendingAction, setPendingAction] = useState(null)
  const cart = useCart()
  const wishlist = useWishlist()
  useEffect(() => {
    function syncRoute() {
      const route = parseRouteFromHash()

      setSelectedGameId(route.gameId)
      setCurrentView(route.view)
      setSelectedNewsId(route.newsId)
      setSelectedUserId(route.userId)
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
    if (
      ['account', 'wallet', 'orders', 'cart', 'wishlist', 'notifications'].includes(currentView) &&
      !isAuthenticated
    ) {
      const route = parseRouteFromHash()
      if (route.view === currentView) navigateTo('login?next=' + encodeURIComponent(route.next))
    }
  }, [status, isLoggingOut, currentView, isAuthenticated])

  useEffect(() => {
    const expired = () => {
      if (isAuthenticated && !['news', 'newsDetail', 'userProfile'].includes(currentView))
        navigateTo('login?next=' + currentView)
    }
    window.addEventListener('vstore:session-expired', expired)
    return () => window.removeEventListener('vstore:session-expired', expired)
  }, [currentView, isAuthenticated])

  function openAuth(mode, action = null) {
    setPendingAction(action)
    setAuthNotice('')
    setAuthMode(mode)
  }

  function closeAuth() {
    if (currentView === 'login' && !completedLogin.current) navigateTo('discover')
    completedLogin.current = false
    setAuthNotice('')
    setAuthMode(null)
    setPendingAction(null)
  }

  async function handleAuthenticated() {
    completedLogin.current = true
    setAuthNotice('')
    const route = parseRouteFromHash()
    if (route.view === 'login')
      navigateTo(
        /^(?:account|wallet|orders|notifications|(?:wishlist|cart)(?:\?add=[^#&]+)?)$/.test(
          route.next,
        )
          ? route.next
          : 'discover',
      )

    if (pendingAction?.type === 'open-cart') {
      openCartPage()
    }

    if (pendingAction?.type === 'open-wishlist') {
      openWishlistPage()
    }

    setPendingAction(null)
  }

  function openGame(gameId) {
    navigateTo(`games/${gameId}`)
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

  function openForgotPassword() {
    setAuthMode(null)
    setPendingAction(null)
    navigateTo('forgot-password')
  }

  async function handlePasswordChanged() {
    setAuthNotice('Password changed. Sign in with your new password.')
    await signOut()
    navigateTo('login?next=account')
    setAuthMode('login')
  }

  function openCartPage() {
    navigateTo('cart')
  }

  function openWishlistPage() {
    navigateTo('wishlist')
  }

  function openCart() {
    openCartPage()
  }
  function openWishlist() {
    openWishlistPage()
  }

  async function signOut(all = false) {
    setAuthMode(null)
    setPendingAction(null)
    navigateTo('discover')
    try {
      await logout(all)
    } catch {
      /* The auth context displays the server error. */
    }
  }
  if (isOAuthCallback) return <OAuthCallbackPage />
  const publicNews = ['news', 'newsDetail'].includes(currentView)
  const publicPage = publicNews || currentView === 'userProfile' || currentView === 'forgotPassword'
  const publicCatalog = ['discover', 'product', 'achievements'].includes(currentView)
  if (!publicPage && status === 'loading')
    return (
      <main className="store-page">
        <p className="store-status" role="status">
          Loading account...
        </p>
      </main>
    )
  if (!publicPage && status === 'banned')
    return (
      <main className="store-page">
        <section className="store-status" role="alert">
          <h1>Account blocked</h1>
          <p>Your account is blocked. Contact support for assistance.</p>
          <button type="button" disabled={isLoggingOut} onClick={() => signOut()}>
            Sign out
          </button>
        </section>
      </main>
    )
  if (!publicPage && !publicCatalog && status === 'error')
    return (
      <main className="store-page">
        <section className="store-status" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Retry loading account
          </button>
        </section>
      </main>
    )

  return (
    <main className="store-page">
      <Header
        activeView={publicNews ? 'news' : currentView}
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
      {error && !publicPage && (
        <div className="store-status" role="alert">
          {error}
          {status === 'error' && (
            <button type="button" onClick={() => window.location.reload()}>
              Retry loading account
            </button>
          )}
          {error.startsWith('Could not complete sign out') && (
            <button type="button" disabled={isLoggingOut} onClick={() => signOut()}>
              Retry sign out
            </button>
          )}
        </div>
      )}
      {currentView === 'userProfile' ? (
        <UserProfilePage
          key={selectedUserId}
          id={selectedUserId}
          onSignIn={() => openAuth('login')}
        />
      ) : currentView === 'news' ? (
        <NewsPage />
      ) : currentView === 'newsDetail' ? (
        <NewsDetailPage key={selectedNewsId} id={selectedNewsId} />
      ) : currentView === 'forgotPassword' ? (
        <PasswordResetRequestPage />
      ) : ['account', 'wallet', 'orders', 'cart', 'wishlist', 'notifications'].includes(
          currentView,
        ) && !user ? (
        <p className="store-status" role="status">
          Please sign in to continue.
        </p>
      ) : ['product', 'achievements'].includes(currentView) ? (
        <ProductDetailPage
          key={selectedGameId}
          id={selectedGameId}
          onSignIn={() => openAuth('login')}
          showAchievements={currentView === 'achievements'}
          onViewAllAchievements={() => navigateTo(`games/${selectedGameId}/achievements`)}
        />
      ) : ['account', 'wallet', 'orders'].includes(currentView) ? (
        <AccountPage
          user={user}
          onUpdated={updateUser}
          onPasswordChanged={handlePasswordChanged}
          onLogoutAll={() => signOut(true)}
          isLoggingOut={isLoggingOut}
          focusWallet={currentView === 'wallet'}
        />
      ) : currentView === 'notifications' ? (
        <NotificationsPage />
      ) : currentView === 'cart' ? (
        <CartPage />
      ) : currentView === 'wishlist' ? (
        <WishlistPage />
      ) : currentView === 'support' ? (
        <SupportPage />
      ) : (
        <DiscoverPage onProductSelect={openGame} />
      )}
      <Footer />
      {(authMode || currentView === 'login') && !isLoggingOut && (
        <RegisterPage
          initialMode={authMode || 'login'}
          initialNotice={authNotice}
          onClose={closeAuth}
          onAuthenticated={handleAuthenticated}
          onForgotPassword={openForgotPassword}
        />
      )}
    </main>
  )
}

export default App
