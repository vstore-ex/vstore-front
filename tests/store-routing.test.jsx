import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../src/App'
import { AuthContext, useAuth } from '../src/auth/context'
import { CartContext } from '../src/cart/context'
import { WishlistContext } from '../src/wishlist/context'
import { CurrencyContext } from '../src/currency/context'
import { WalletContext } from '../src/wallet/context'
import { OrdersContext } from '../src/orders/context'
import { apiRequest } from '../src/api/client'
import { consumeOAuthDestination, rememberOAuthDestination } from '../src/auth/oauth'

vi.mock('../src/api/client', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}))
// Keep the application router, public catalog/search and cart page real. Isolate the
// credential form and unrelated product body so these tests target route boundaries.
vi.mock('../src/pages/RegisterPage/RegisterPage', () => ({
  default: function Login({ onAuthenticated, onClose }) {
    const { login } = useAuth()
    return (
      <button
        onClick={async () => {
          await login()
          await onAuthenticated()
          onClose()
        }}
      >
        Complete sign in
      </button>
    )
  },
}))
vi.mock('../src/pages/ProductDetailPage/ProductDetailPage', () => ({
  default: ({ id, showAchievements }) => (
    <h1>
      {showAchievements ? 'Achievements' : 'Product'} {id}
    </h1>
  ),
}))
vi.mock('../src/pages/NotificationsPage/NotificationsPage', () => ({
  default: () => <h1>Notification page</h1>,
}))
vi.mock('../src/pages/MessagesPage/MessagesPage', () => ({
  default: ({ conversationId }) => <h1>Messages {conversationId || 'inbox'}</h1>,
}))
vi.mock('../src/pages/LibraryPage/LibraryPage', () => ({
  default: () => <h1>Your library</h1>,
}))
vi.mock('../src/pages/AccountPage/AccountPage', () => ({
  default: ({ focusLibrary }) => <h1>{focusLibrary ? 'Your library' : 'Your account'}</h1>,
}))

const gameId = '851241d0-1d80-4b71-b6ea-d7e7f5b5891a'
const game = { id: gameId, title: 'Orbit', price: '20.00', currency: 'USD' }
let games, cart, wishlist
beforeEach(() => {
  games = [game]
  cart = {
    items: [],
    count: 0,
    total: '0.00',
    subtotal: '0.00',
    tax: '0.00',
    currency: 'USD',
    pricesReady: true,
    loading: false,
    busy: false,
    error: '',
    addToCart: vi.fn(async () => true),
  }
  wishlist = { items: [], count: 0, add: vi.fn(async () => true) }
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  apiRequest.mockReset()
  apiRequest.mockImplementation(async (path) => {
    if (path.startsWith('/games/?')) return games
    if (path.startsWith('/search/games?')) return [game]
    if (path.startsWith('/discover/discover?')) return {}
    if (path === '/taxonomy/tags') return [{ id: 7, name: 'Adventure' }]
    throw new Error('Unexpected API request: ' + path)
  })
})

function Store({ initialStatus = 'anonymous' }) {
  const [status, setStatus] = useState(initialStatus)
  const user = status === 'authenticated' ? { id: 7 } : null
  return (
    <AuthContext.Provider
      value={{
        status,
        currentUser: user,
        isAuthenticated: !!user,
        error: status === 'error' ? 'Session service unavailable' : '',
        login: async () => setStatus('authenticated'),
        logout: vi.fn(),
        updateUser: vi.fn(),
      }}
    >
      <WalletContext.Provider value={{ data: { balance: '100.00', currency: 'USD' } }}>
        <CurrencyContext.Provider
          value={{
            code: 'USD',
            currencies: [{ code: 'USD', name: 'US Dollar', symbol: '$' }],
            choose: vi.fn(),
          }}
        >
          <CartContext.Provider value={cart}>
            <WishlistContext.Provider value={wishlist}>
              <OrdersContext.Provider value={{ ownedIds: [], data: [] }}>
                <App />
              </OrdersContext.Provider>
            </WishlistContext.Provider>
          </CartContext.Provider>
        </CurrencyContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
const setLocation = (url) => window.history.replaceState(null, '', url)
const catalogRequests = () => apiRequest.mock.calls.filter(([path]) => path.startsWith('/games/?'))
const lastCatalogQuery = () => new URLSearchParams(catalogRequests().at(-1)?.[0].split('?')[1])

describe('not-found and library navigation', () => {
  test.each([
    '/missing',
    '/#/missing',
    '/#/games',
    '/#/games/1/typo',
    '/#/news/1/extra',
    '/#/account/extra',
    '/#/discover/extra',
  ])('shows 404 for %s without silently loading the catalog', async (url) => {
    setLocation(url)
    render(<Store />)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(catalogRequests()).toHaveLength(0)
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to store' }))
    await screen.findByText('Orbit', { selector: '.store-row__title' })
  })
  test.each(['loading', 'error'])('404 is public when auth is %s', async (initialStatus) => {
    setLocation('/#/missing')
    render(<Store initialStatus={initialStatus} />)
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
  test.each(['/products/' + gameId, '/#/products/' + gameId, '/#/games/' + gameId])(
    'preserves game links at %s',
    async (url) => {
      setLocation(url)
      render(<Store />)
      expect(await screen.findByRole('heading', { name: 'Product ' + gameId })).toBeInTheDocument()
    },
  )
  test('keeps the public 404 page visible when a signed-in session expires', async () => {
    setLocation('/#/missing-page')
    render(<Store initialStatus="authenticated" />)
    await screen.findByRole('heading', { name: 'Page not found' })
    act(() => window.dispatchEvent(new Event('vstore:session-expired')))
    expect(window.location.hash).toBe('#/missing-page')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
  test('returns a guest to the library after sign-in', async () => {
    setLocation('/#/library')
    const user = userEvent.setup()
    render(<Store />)
    await user.click(await screen.findByRole('button', { name: 'Complete sign in' }))
    expect(await screen.findByRole('heading', { name: 'Your library' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/library')
  })
  test.each(['/#/library', '/#/login?next=library'])(
    'preserves the library OAuth destination from %s',
    (url) => {
      setLocation(url)
      rememberOAuthDestination()
      expect(consumeOAuthDestination()).toBe('#/library')
    },
  )
})

describe('public catalog when the session service fails (#22)', () => {
  test('loads real catalog data and offers session recovery without blocking browsing', async () => {
    setLocation('/#/discover?view=catalog')
    render(<Store initialStatus="error" />)
    expect(await screen.findByRole('link', { name: /Orbit/ })).toHaveAttribute(
      'href',
      '#/games/' + gameId,
    )
    expect(screen.getByText('Session service unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry loading account' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(lastCatalogQuery().get('currency')).toBe('USD')
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/games/?'),
      expect.objectContaining({ auth: false, credentials: 'omit' }),
    )
  })

  test.each([
    ['/#/games/' + gameId, 'Product ' + gameId],
    ['/#/products/' + gameId + '/achievements', 'Achievements ' + gameId],
  ])('keeps public route %s available', async (url, heading) => {
    setLocation(url)
    render(<Store initialStatus="error" />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  test.each(['account', 'wallet', 'orders', 'cart', 'wishlist', 'notifications'])(
    'still gates private %s on an unresolved session',
    (route) => {
      setLocation('/#/' + route)
      render(<Store initialStatus="error" />)
      expect(screen.getByRole('button', { name: 'Retry loading account' })).toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
      expect(apiRequest).not.toHaveBeenCalled()
    },
  )

  test('preserves the blocked-account screen', () => {
    setLocation('/#/discover')
    render(<Store initialStatus="banned" />)
    expect(screen.getByRole('heading', { name: 'Account blocked' })).toBeInTheDocument()
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

test('password reset request route is public and links back to sign in', async () => {
  setLocation('/#/forgot-password')
  const user = userEvent.setup()
  render(<Store />)

  expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalled()
  await user.click(screen.getByRole('link', { name: 'Back to sign in' }))
  expect(await screen.findByRole('button', { name: 'Complete sign in' })).toBeInTheDocument()
})

describe('catalog URL state (#22)', () => {
  test('reads direct-path filters and keeps tag/pagination state across history navigation', async () => {
    games = Array.from({ length: 25 }, (_, i) => ({
      ...game,
      id: String(i + 1),
      title: 'Game ' + (i + 1),
    }))
    setLocation('/discover?view=catalog&tag_id=7&page=2')
    const user = userEvent.setup()
    render(<Store />)
    await screen.findByText('Game 1', { selector: '.store-row__title' })
    expect(lastCatalogQuery().get('tag_id')).toBe('7')
    expect(lastCatalogQuery().get('skip')).toBe('24')
    expect(lastCatalogQuery().get('limit')).toBe('25')
    expect(screen.getByRole('button', { name: 'Adventure' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(lastCatalogQuery().get('skip')).toBe('48'))
    expect(lastCatalogQuery().get('tag_id')).toBe('7')
    await act(async () => window.history.back())
    await waitFor(() => expect(lastCatalogQuery().get('skip')).toBe('24'))
    await user.click(screen.getByRole('button', { name: 'All tags' }))
    await waitFor(() => expect(lastCatalogQuery().get('skip')).toBe('0'))
    expect(lastCatalogQuery().has('tag_id')).toBe(false)
  })

  test.each(['/discover?q=Orbit%3F&view=catalog', '/#/discover?q=Orbit?'])(
    'reads search from %s in the header and results',
    async (url) => {
      setLocation(url)
      render(<Store />)
      expect(
        await screen.findByRole('heading', { name: 'Search results for Orbit?' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('searchbox')).toHaveValue('Orbit?')
      expect(apiRequest).toHaveBeenCalledWith(
        '/search/games?q=Orbit%3F&currency=USD',
        expect.anything(),
      )
      expect(catalogRequests()).toHaveLength(0)
    },
  )

  test('hash query takes precedence over stale pathname query', async () => {
    setLocation('/discover?tag_id=7&page=2#/discover?q=Orbit')
    render(<Store />)
    expect(
      await screen.findByRole('heading', { name: 'Search results for Orbit' }),
    ).toBeInTheDocument()
    expect(catalogRequests()).toHaveLength(0)
  })

  test('can retry a catalog API failure while the account service is unavailable', async () => {
    setLocation('/#/discover?view=catalog')
    const load = apiRequest.getMockImplementation()
    let failed = false
    apiRequest.mockImplementation((path, options) => {
      if (path.startsWith('/games/?') && !failed) {
        failed = true
        return Promise.reject(new Error('Catalog temporarily unavailable'))
      }
      return load(path, options)
    })
    const user = userEvent.setup()
    render(<Store initialStatus="error" />)
    await user.click(await screen.findByRole('button', { name: 'Retry games' }))
    expect(await screen.findByRole('link', { name: /Orbit/ })).toBeInTheDocument()
    expect(screen.queryByText('Catalog temporarily unavailable')).not.toBeInTheDocument()
  })
})

describe('cart return destination (#32)', () => {
  test.each(['/#/cart?add=' + gameId, '/cart?add=' + gameId])(
    'retains the selected game through sign-in from %s',
    async (url) => {
      setLocation(url)
      const user = userEvent.setup()
      render(<Store />)
      await screen.findByRole('button', { name: 'Complete sign in' })
      const next = new URLSearchParams(window.location.hash.split('?')[1]).get('next')
      expect(next).toBe('cart?add=' + gameId)
      expect(cart.addToCart).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Complete sign in' }))
      await screen.findByRole('heading', { name: 'My Cart' })
      await waitFor(() => expect(cart.addToCart).toHaveBeenCalledExactlyOnceWith(gameId))
      expect(window.location.hash).toBe('#/cart')
    },
  )

  test('consumes a signed-in direct-path add exactly once', async () => {
    setLocation('/cart?add=' + gameId)
    render(<Store initialStatus="authenticated" />)
    await screen.findByRole('heading', { name: 'My Cart' })
    await waitFor(() => expect(cart.addToCart).toHaveBeenCalledExactlyOnceWith(gameId))
    expect(window.location.hash).toBe('#/cart')
  })

  test('ignores arbitrary redirect parameters when guarding the cart', async () => {
    setLocation('/#/cart?next=https://example.com&add=' + gameId)
    render(<Store />)
    await screen.findByRole('button', { name: 'Complete sign in' })
    expect(new URLSearchParams(window.location.hash.split('?')[1]).get('next')).toBe(
      'cart?add=' + gameId,
    )
  })

  test.each(['/#/wishlist?add=' + gameId, '/wishlist?add=' + gameId])(
    'preserves the shared sign-in flow for %s',
    async (url) => {
      setLocation(url)
      const user = userEvent.setup()
      render(<Store />)
      await user.click(await screen.findByRole('button', { name: 'Complete sign in' }))
      await screen.findByRole('heading', { name: 'My Wishlist' })
      await waitFor(() => expect(wishlist.add).toHaveBeenCalledExactlyOnceWith(gameId))
      expect(cart.addToCart).not.toHaveBeenCalled()
      expect(window.location.hash).toBe('#/wishlist')
    },
  )
})

describe('notifications routing (#110)', () => {
  test('guards direct links and returns to notifications after signing in', async () => {
    setLocation('/#/notifications')
    const user = userEvent.setup()
    render(<Store />)
    await screen.findByRole('button', { name: 'Complete sign in' })
    expect(window.location.hash).toBe('#/login?next=notifications')
    expect(screen.queryByRole('button', { name: /Notifications,/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Complete sign in' }))
    expect(await screen.findByRole('heading', { name: 'Notification page' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/notifications')
  })
  test('supports a signed-in direct link', async () => {
    setLocation('/#/notifications')
    render(<Store initialStatus="authenticated" />)
    expect(await screen.findByRole('heading', { name: 'Notification page' })).toBeInTheDocument()
  })
  test.each(['/#/notifications', '/#/login?next=notifications'])(
    'preserves the notification destination through OAuth from %s',
    (path) => {
      setLocation(path)
      rememberOAuthDestination()
      expect(consumeOAuthDestination()).toBe('#/notifications')
      expect(consumeOAuthDestination()).toBe('#/discover')
    },
  )
})

describe('private message routes', () => {
  test.each(['/#/messages/12', '/messages/12', '/#/messages'])(
    'guards %s and restores the destination after sign-in',
    async (path) => {
      setLocation(path)
      const user = userEvent.setup()
      render(<Store />)
      await user.click(await screen.findByRole('button', { name: 'Complete sign in' }))
      expect(
        await screen.findByRole('heading', {
          name: path.endsWith('/12') ? 'Messages 12' : 'Messages inbox',
        }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Messages', exact: true })).toHaveAttribute(
        'href',
        '#/messages',
      )
    },
  )
  test.each(['/#/messages/12', '/#/login?next=messages%2F12'])(
    'preserves a conversation through OAuth from %s',
    (path) => {
      setLocation(path)
      rememberOAuthDestination()
      expect(consumeOAuthDestination()).toBe('#/messages/12')
    },
  )
  test.each(['/#/messages/nope', '/#/messages/0', '/#/messages/12/other'])(
    'invalid message route %s shows 404',
    async (path) => {
      setLocation(path)
      render(<Store />)
      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    },
  )
  test('session expiry preserves the active conversation destination', async () => {
    setLocation('/#/messages/12')
    render(<Store initialStatus="authenticated" />)
    await screen.findByRole('heading', { name: 'Messages 12' })
    act(() => window.dispatchEvent(new Event('vstore:session-expired')))
    await waitFor(() => expect(window.location.hash).toBe('#/login?next=messages%2F12'))
  })
})

test('footer hides Wallet only on Discover and restores it on other routes', async () => {
  window.location.hash = '#/discover'
  render(<Store initialStatus="authenticated" />)
  await screen.findByRole('heading', { name: 'All games' })
  const footer = document.querySelector('.store-footer')
  expect(footer.querySelector('a[href="#/wallet"]')).toBeNull()
  await act(async () => {
    window.location.hash = '#/library'
  })
  await screen.findByRole('heading', { name: 'Your library' })
  expect(footer.querySelector('a[href="#/wallet"]')).not.toBeNull()
  await act(async () => {
    window.location.hash = '#/discover'
  })
  await screen.findByRole('heading', { name: 'All games' })
  expect(footer.querySelector('a[href="#/wallet"]')).toBeNull()
})
