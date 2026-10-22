import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthContext, useAuth } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import { CurrencyContext } from '../src/currency/context'
import CartProvider from '../src/cart/CartProvider'
import { useCart } from '../src/cart/context'
import OrdersProvider from '../src/orders/OrdersProvider'
import WishlistProvider from '../src/wishlist/WishlistProvider'
import { useWishlist } from '../src/wishlist/context'
import Header from '../src/components/Header/Header'
import AddToCartButton from '../src/components/Cart/AddToCartButton'
import WishlistButton from '../src/components/Wishlist/WishlistButton'
import CartPage from '../src/pages/CartPage/CartPage'
import WishlistPage from '../src/pages/WishlistPage/WishlistPage'
import * as cartApi from '../src/api/cart'
import * as wishlistApi from '../src/api/wishlist'
import { deferred } from './helpers'

vi.mock('../src/api/cart', async importOriginal => ({
  ...await importOriginal(), getCart: vi.fn(), addToCart: vi.fn(), removeFromCart: vi.fn(),
  clearCart: vi.fn(), createOrder: vi.fn(), getOrders: vi.fn(),
}))
vi.mock('../src/api/wishlist', async importOriginal => ({
  ...await importOriginal(), getWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn(),
}))

const game = { game_id: '1', title: 'Orbit', price: '20.00' }
const secondGame = { game_id: '2', title: 'Lunar', price: '10.00' }
const wish = { id: '1', title: 'Orbit', image: '', price: 2000, currency: 'USD', tags: [], type: 'Base game' }
const cartData = (items = []) => ({
  items, subtotal: items.length ? '30.00' : '0.00', tax: items.length ? '3.00' : '0.00',
  total: items.length ? '33.00' : '0.00', currency: 'USD',
})
let serverCart, serverWishlist, serverOrders, actions

beforeEach(() => {
  serverCart = cartData()
  serverWishlist = []
  serverOrders = []
  actions = { onSignIn: vi.fn(), onSignOut: vi.fn(), onCart: vi.fn(), onWishlist: vi.fn(), onAccount: vi.fn() }
  for (const api of [cartApi, wishlistApi]) {
    Object.values(api).filter(vi.isMockFunction).forEach(mock => mock.mockReset())
  }
  cartApi.getCart.mockImplementation(async () => structuredClone(serverCart))
  cartApi.addToCart.mockImplementation(async () => { serverCart = cartData([game]) })
  cartApi.removeFromCart.mockImplementation(async id => { serverCart = cartData(serverCart.items.filter(item => item.game_id !== id)) })
  cartApi.clearCart.mockImplementation(async () => { serverCart = cartData() })
  cartApi.getOrders.mockImplementation(async () => structuredClone(serverOrders))
  cartApi.createOrder.mockImplementation(async () => {
    const order = { id: 99, status: 'paid', total: serverCart.total, currency: 'USD', items: serverCart.items }
    serverOrders = [order]
    serverCart = cartData()
    serverWishlist = []
    return order
  })
  wishlistApi.getWishlist.mockImplementation(async () => structuredClone(serverWishlist))
  wishlistApi.addToWishlist.mockImplementation(async () => { serverWishlist = [wish] })
  wishlistApi.removeFromWishlist.mockImplementation(async () => { serverWishlist = [] })
})

function Shopping({ view = 'cart' }) {
  const auth = useAuth()
  const cart = useCart()
  const wishlist = useWishlist()
  return <>
    <Header isAuthenticated={auth.isAuthenticated} isLoggingOut={view === 'header-logout'} cartCount={cart.count} wishlistCount={wishlist.count} {...actions} />
    {view === 'header-logout' ? null : <section aria-label="Game actions"><AddToCartButton gameId="1" /><WishlistButton gameId="1" /></section>}
    {view === 'header-logout' ? null : view === 'cart' ? <CartPage /> : <WishlistPage />}
  </>
}

function Shop({ userId = 7, view = 'cart', currencyCode = 'USD' }) {
  const wallet = {
    data: { balance: '100.00', currency: 'USD' }, error: '', loading: false, busy: false,
    operation: null, revision: 0, refresh: vi.fn(async () => wallet.data), topUp: vi.fn(), changeCurrency: vi.fn(),
  }
  const currency = { code: currencyCode, currencies: [{ code: 'USD', name: 'US Dollar' }], choose: vi.fn(),
    switching: false, unavailable: '', walletError: '', refreshWallet: vi.fn(), disabled: false, loading: false }
  return <AuthContext.Provider value={{ currentUser: userId == null ? null : { id: userId }, isAuthenticated: userId != null }}>
    <WalletContext.Provider value={wallet}><CurrencyContext.Provider value={currency}>
      <CartProvider><OrdersProvider><WishlistProvider><Shopping view={view} /></WishlistProvider></OrdersProvider></CartProvider>
    </CurrencyContext.Provider></WalletContext.Provider>
  </AuthContext.Provider>
}
const header = () => within(screen.getByRole('banner', { name: 'Store navigation' }))
const gameActions = () => within(screen.getByRole('region', { name: 'Game actions' }))
async function ready() {
  await waitFor(() => {
    expect(screen.queryByText('Loading cart...')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading wishlist...')).not.toBeInTheDocument()
    expect(screen.queryByText('Checking library...')).not.toBeInTheDocument()
  })
}

describe('authenticated cart and header', () => {
  test('waits for currency and initial cart before consuming a post-login add', async () => {
    window.history.replaceState(null, '', '/#/cart?add=1')
    const pending = deferred()
    cartApi.addToCart.mockReturnValueOnce(pending.promise)
    const { rerender } = render(<Shop currencyCode={null} />)
    expect(cartApi.addToCart).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/cart?add=1')
    rerender(<Shop currencyCode="USD" />)
    await waitFor(() => expect(cartApi.addToCart).toHaveBeenCalledExactlyOnceWith('1'))
    serverCart = cartData([game])
    await act(async () => pending.resolve())
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(header().getByLabelText('1 items in cart')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/cart')
  })

  test('waits for currency before consuming a post-login wishlist add', async () => {
    window.history.replaceState(null, '', '/#/wishlist?add=1')
    const pending = deferred()
    wishlistApi.addToWishlist.mockReturnValueOnce(pending.promise)
    const { rerender } = render(<Shop currencyCode={null} view="wishlist" />)
    expect(wishlistApi.addToWishlist).not.toHaveBeenCalled()
    rerender(<Shop currencyCode="USD" view="wishlist" />)
    await waitFor(() => expect(wishlistApi.addToWishlist).toHaveBeenCalledExactlyOnceWith('1'))
    serverWishlist = [wish]
    await act(async () => pending.resolve())
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(header().getByLabelText('1 items in wishlist')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/wishlist')
  })

  test('shows initial loading, then server totals and an accessible reactive badge', async () => {
    const initial = deferred()
    cartApi.getCart.mockReturnValueOnce(initial.promise)
    render(<Shop />)
    expect(screen.getByText('Loading cart...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument()
    await act(async () => initial.resolve(cartData([game, secondGame])))
    await ready()
    expect(header().getByLabelText('2 items in cart')).toHaveTextContent('2')
    expect(header().getByRole('button', { name: 'Cart' })).toHaveAccessibleDescription('2')
    const summary = within(screen.getByRole('complementary', { name: 'Cart summary' }))
    expect(summary.getByText('$30.00')).toBeInTheDocument()
    expect(summary.getByText('$3.00')).toBeInTheDocument()
    expect(summary.getByText('$33.00')).toBeInTheDocument()
  })

  test('adds a game through the real button and updates the cart and header', async () => {
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    await user.click(gameActions().getByRole('button', { name: 'Add to cart' }))
    expect(cartApi.addToCart).toHaveBeenCalledWith('1')
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(header().getByLabelText('1 items in cart')).toHaveTextContent('1')
    expect(window.location.hash).toBe('#/cart')
  })

  test('removes an item and clears the remaining cart without stale badges', async () => {
    serverCart = cartData([game, secondGame])
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    await user.click(within(screen.getByRole('heading', { name: 'Orbit' }).closest('article')).getByRole('button', { name: 'Remove' }))
    expect(cartApi.removeFromCart).toHaveBeenCalledWith('1')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Orbit' })).not.toBeInTheDocument())
    expect(header().getByLabelText('1 items in cart')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear cart' }))
    expect(cartApi.clearCart).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(header().queryByLabelText(/items in cart/)).not.toBeInTheDocument()
  })

  test('shows a recoverable initial API failure', async () => {
    cartApi.getCart.mockRejectedValueOnce({ status: 503, message: 'unavailable' })
    const user = userEvent.setup()
    render(<Shop />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not complete this action')
    expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument()
    serverCart = cartData([game])
    await user.click(screen.getByRole('button', { name: 'Retry cart' }))
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('blocks duplicate add clicks while the request is pending', async () => {
    const pending = deferred()
    cartApi.addToCart.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    const add = gameActions().getByRole('button', { name: 'Add to cart' })
    await user.click(add)
    expect(add).toBeDisabled()
    await user.click(add)
    expect(cartApi.addToCart).toHaveBeenCalledTimes(1)
    serverCart = cartData([game])
    await act(async () => pending.resolve())
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
  })

  test('does not leak a late cart response across a user change', async () => {
    const oldSession = deferred()
    cartApi.getCart.mockReturnValueOnce(oldSession.promise)
    const { rerender } = render(<Shop userId={7} />)
    rerender(<Shop userId={8} />)
    await ready()
    await act(async () => oldSession.resolve(cartData([game])))
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(header().queryByLabelText(/items in cart/)).not.toBeInTheDocument()
  })

  test('reconciles a duplicate add from another session and displays the server error', async () => {
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    serverCart = cartData([game])
    cartApi.addToCart.mockRejectedValueOnce({ status: 400, message: 'already in cart' })
    await user.click(gameActions().getByRole('button', { name: 'Add to cart' }))
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(header().getByLabelText('1 items in cart')).toBeInTheDocument()
    expect(gameActions().getByRole('alert')).toHaveTextContent('This game is already in your cart.')
  })
})

describe('checkout', () => {
  test('requires terms, prevents duplicate orders and updates cart/wishlist/ownership after success', async () => {
    serverCart = cartData([game])
    serverWishlist = [wish]
    const pending = deferred()
    cartApi.createOrder.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Check Out' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Checkout' }))
    expect(dialog.getByRole('button', { name: 'Place Order' })).toBeDisabled()
    await user.click(dialog.getByRole('checkbox', { name: 'I accept the purchase terms.' }))
    await user.click(dialog.getByRole('button', { name: 'Place Order' }))
    expect(cartApi.createOrder).toHaveBeenCalledWith('card', true)
    const submitting = dialog.getByRole('button', { name: 'Placing order...' })
    expect(submitting).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(submitting)
    expect(cartApi.createOrder).toHaveBeenCalledTimes(1)
    serverOrders = [{ id: 99, status: 'paid', items: [game], total: '33.00', currency: 'USD' }]
    serverWishlist = []
    serverCart = cartData()
    await act(async () => pending.resolve(serverOrders[0]))
    expect(await screen.findByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(header().queryByLabelText(/items in cart/)).not.toBeInTheDocument()
    await waitFor(() => expect(header().queryByLabelText(/items in wishlist/)).not.toBeInTheDocument())
    expect(gameActions().getByText('In your library')).toBeInTheDocument()
    expect(gameActions().queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
  })

  test('keeps cart items and the dialog after a failed payment, then permits retry', async () => {
    serverCart = cartData([game])
    cartApi.createOrder.mockRejectedValueOnce({ status: 503, message: 'Payment service unavailable' })
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Check Out' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Checkout' }))
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: 'Place Order' }))
    expect(await dialog.findByText('The server could not complete this action', { exact: false })).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Refresh cart to retry' })).toBeInTheDocument()
    expect(header().getByLabelText('1 items in cart')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Place Order' })).toBeDisabled()
    await user.click(dialog.getByRole('button', { name: 'Refresh cart to retry' }))
    expect(await waitFor(() => expect(dialog.getByRole('button', { name: 'Place Order' })).toBeEnabled()))
    await user.click(dialog.getByRole('button', { name: 'Place Order' }))
    expect(await screen.findByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
  })

  test('cancels checkout without placing an order', async () => {
    serverCart = cartData([game])
    const user = userEvent.setup()
    render(<Shop />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Check Out' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cartApi.createOrder).not.toHaveBeenCalled()
    expect(header().getByLabelText('1 items in cart')).toBeInTheDocument()
  })
})

describe('wishlist and authentication', () => {
  test('adds/removes saved membership and synchronizes the button and header indicator', async () => {
    const user = userEvent.setup()
    render(<Shop view="wishlist" />)
    await ready()
    expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument()
    await user.click(gameActions().getByRole('button', { name: 'Wishlist' }))
    expect(wishlistApi.addToWishlist).toHaveBeenCalledWith('1')
    expect(await screen.findByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
    expect(gameActions().getByRole('link', { name: 'In your wishlist' })).toHaveAttribute('href', '#/wishlist')
    expect(header().getByLabelText('1 items in wishlist')).toHaveTextContent('1')
    await user.click(within(screen.getByRole('region', { name: 'Wishlist items' })).getByRole('button', { name: 'Remove' }))
    expect(wishlistApi.removeFromWishlist).toHaveBeenCalledWith('1')
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument()
    expect(header().queryByLabelText(/items in wishlist/)).not.toBeInTheDocument()
    expect(gameActions().getByRole('button', { name: 'Wishlist' })).toBeEnabled()
  })

  test('retains a saved game when removal fails and exposes retry', async () => {
    serverWishlist = [wish]
    wishlistApi.removeFromWishlist.mockRejectedValueOnce(new Error('Wishlist temporarily unavailable'))
    const user = userEvent.setup()
    render(<Shop view="wishlist" />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wishlist temporarily unavailable')
    expect(header().getByLabelText('1 items in wishlist')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry wishlist' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  test('shows wishlist loading and discards an old user response after signing out', async () => {
    const initial = deferred()
    wishlistApi.getWishlist.mockReturnValueOnce(initial.promise)
    const { rerender } = render(<Shop view="wishlist" />)
    expect(screen.getByText('Loading wishlist...')).toBeInTheDocument()
    rerender(<Shop userId={null} view="wishlist" />)
    await act(async () => initial.resolve([wish]))
    expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument()
    expect(header().queryByLabelText(/items in wishlist/)).not.toBeInTheDocument()
  })

  test('hides save/add actions for an already owned game', async () => {
    serverOrders = [{ id: 1, status: 'paid', items: [game] }]
    render(<Shop />)
    await ready()
    expect(gameActions().getByRole('link', { name: 'View library' })).toBeInTheDocument()
    expect(gameActions().queryByRole('button')).not.toBeInTheDocument()
    expect(cartApi.addToCart).not.toHaveBeenCalled()
    expect(wishlistApi.addToWishlist).not.toHaveBeenCalled()
  })

  test('uses guest sign-in actions and preserves the requested cart/wishlist destination', async () => {
    const user = userEvent.setup()
    render(<Shop userId={null} />)
    expect(header().queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    await user.click(header().getByRole('button', { name: 'Sign in' }))
    expect(actions.onSignIn).toHaveBeenCalledTimes(1)
    await user.click(gameActions().getByRole('button', { name: 'Add to cart' }))
    expect(window.location.hash).toBe('#/login?next=cart%3Fadd%3D1')
    await user.click(gameActions().getByRole('button', { name: 'Wishlist' }))
    expect(window.location.hash).toBe('#/login?next=wishlist%3Fadd%3D1')
    expect(cartApi.getCart).not.toHaveBeenCalled()
    expect(wishlistApi.getWishlist).not.toHaveBeenCalled()
    expect(cartApi.addToCart).not.toHaveBeenCalled()
    expect(wishlistApi.addToWishlist).not.toHaveBeenCalled()
  })

  test('dispatches signed-in header actions and clears personal indicators after sign-out', async () => {
    serverCart = cartData([game])
    serverWishlist = [wish]
    const user = userEvent.setup()
    const { rerender } = render(<Shop />)
    await ready()
    expect(header().queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    for (const [name, handler] of [['Cart', 'onCart'], ['Wishlist', 'onWishlist'], ['Account', 'onAccount'], ['Sign out', 'onSignOut']]) {
      await user.click(header().getByRole('button', { name }))
      expect(actions[handler]).toHaveBeenCalledTimes(1)
    }
    rerender(<Shop userId={null} />)
    expect(header().getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(header().queryByLabelText(/items in (cart|wishlist)/)).not.toBeInTheDocument()
  })

  test('disables repeated sign-out while the session is ending', async () => {
    const user = userEvent.setup()
    render(<Shop userId={null} view="header-logout" />)
    const pending = header().getByRole('button', { name: 'Signing out...' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(actions.onSignOut).not.toHaveBeenCalled()
    expect(header().queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
  })
})
