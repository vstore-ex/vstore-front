import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import { CurrencyContext } from '../src/currency/context'
import CartProvider from '../src/cart/CartProvider'
import { useCart } from '../src/cart/context'
import OrdersProvider from '../src/orders/OrdersProvider'
import Header from '../src/components/Header/Header'
import AddToCartButton from '../src/components/Cart/AddToCartButton'
import CartPage from '../src/pages/CartPage/CartPage'
import * as api from '../src/api/cart'
import { deferred } from './helpers'

vi.mock('../src/api/cart', async (original) => ({
  ...(await original()),
  getCart: vi.fn(),
  getOrders: vi.fn(),
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
  createOrder: vi.fn(),
}))
const orbit = { game_id: '1', title: 'Orbit', price: '20.00' }
const lunar = { game_id: '2', title: 'Lunar', price: '20.00' }
let serverCode, serverItems
const refreshWallet = vi.fn()
function cartData(code = serverCode, items = serverItems) {
  return {
    items: [...items],
    currency: code,
    subtotal: String(items.length * 20),
    tax: '0',
    total: String(items.length * 20),
  }
}
beforeEach(() => {
  serverCode = 'USD'
  serverItems = [orbit, lunar]
  for (const fn of Object.values(api).filter(vi.isMockFunction)) fn.mockReset()
  api.getCart.mockImplementation(async () => cartData())
  api.getOrders.mockResolvedValue([])
  refreshWallet.mockReset()
})
function Shopping({ pageKey }) {
  const cart = useCart()
  return (
    <>
      <Header isAuthenticated cartCount={cart.count} />
      <AddToCartButton gameId="1" />
      <CartPage key={pageKey} />
    </>
  )
}
function Shop({ code = 'USD', owner = 7, pageKey = 0 }) {
  return (
    <AuthContext.Provider value={{ currentUser: { id: owner }, isAuthenticated: true }}>
      <WalletContext.Provider
        value={{ data: { balance: '100', currency: code }, refresh: refreshWallet }}
      >
        <CurrencyContext.Provider
          value={{ code, currencies: [{ code, name: code }], switching: false, unavailable: '' }}
        >
          <CartProvider>
            <OrdersProvider>
              <Shopping pageKey={pageKey} />
            </OrdersProvider>
          </CartProvider>
        </CurrencyContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
async function ready() {
  await waitFor(() => {
    expect(screen.queryByText('Loading cart...')).not.toBeInTheDocument()
    expect(screen.queryByText('Checking library...')).not.toBeInTheDocument()
  })
}

test.each([
  ['add', 'Add to cart', 'addToCart'],
  ['remove', 'Remove', 'removeFromCart'],
  ['clear', 'Clear cart', 'clearCart'],
])('reconciles a pending %s using the latest wallet currency', async (action, label, apiMethod) => {
  if (action === 'add') serverItems = []
  const user = userEvent.setup()
  const pending = deferred()
  api[apiMethod].mockReturnValueOnce(pending.promise)
  const { rerender } = render(<Shop />)
  await ready()
  await user.click(screen.getAllByRole('button', { name: label, exact: true })[0])
  serverCode = 'EUR'
  rerender(<Shop code="EUR" />)
  await waitFor(() => expect(api.getCart).toHaveBeenCalledTimes(2))
  await ready()
  serverItems = action === 'add' ? [orbit] : action === 'remove' ? [lunar] : []
  await act(async () => pending.resolve())
  await ready()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api[apiMethod]).toHaveBeenCalledTimes(1)
  if (action === 'clear') {
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/items in cart/)).not.toBeInTheDocument()
  } else {
    expect(screen.getByLabelText('1 items in cart')).toBeInTheDocument()
    expect(
      within(screen.getByRole('complementary', { name: 'Cart summary' })).getAllByText('€20.00'),
    ).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled()
  }
})

test('reconciles a late duplicate-add error in the current currency without losing the server cart', async () => {
  serverItems = []
  const pending = deferred()
  api.addToCart.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  const { rerender } = render(<Shop />)
  await ready()
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  serverCode = 'EUR'
  rerender(<Shop code="EUR" />)
  await ready()
  serverItems = [orbit, lunar]
  await act(async () => pending.reject({ status: 400, message: 'already in cart' }))
  expect(screen.getByRole('heading', { name: 'Lunar' })).toBeInTheDocument()
  expect(screen.getByLabelText('2 items in cart')).toBeInTheDocument()
  expect(screen.getAllByText('This game is already in your cart.').length).toBeGreaterThan(0)
  expect(api.addToCart).toHaveBeenCalledTimes(1)
})

test('still rejects a server response in the wrong currency', async () => {
  serverCode = 'EUR'
  serverItems = []
  const user = userEvent.setup()
  render(<Shop code="EUR" />)
  await ready()
  api.getCart.mockResolvedValueOnce(cartData('USD', [orbit]))
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Cart prices do not match your wallet currency.',
  )
  expect(screen.queryByRole('button', { name: 'Check Out' })).not.toBeInTheDocument()
})

test.each([false, true])(
  'keeps a completed checkout empty after a currency change (delayed refresh: %s)',
  async (delayedRefresh) => {
    serverItems = [orbit]
    const payment = deferred()
    const oldCart = deferred()
    api.createOrder.mockReturnValueOnce(payment.promise)
    const user = userEvent.setup()
    const { rerender } = render(<Shop />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Check Out' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Checkout' }))
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: 'Place Order' }))
    serverCode = 'EUR'
    if (delayedRefresh) api.getCart.mockReturnValueOnce(oldCart.promise)
    rerender(<Shop code="EUR" />)
    await waitFor(() => expect(api.getCart).toHaveBeenCalledTimes(2))
    const order = { id: 99, status: 'paid', total: '20.00', currency: 'USD', items: [orbit] }
    api.getOrders.mockResolvedValue([order])
    serverItems = []
    await act(async () => payment.resolve(order))
    expect(screen.getByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
    expect(screen.getByText('$20.00')).toBeInTheDocument()
    expect(screen.queryByLabelText(/items in cart/)).not.toBeInTheDocument()
    if (delayedRefresh) await act(async () => oldCart.resolve(cartData('EUR', [orbit])))
    expect(screen.queryByLabelText(/items in cart/)).not.toBeInTheDocument()
    rerender(<Shop code="EUR" pageKey={1} />)
    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(screen.queryByText('Loading cart...')).not.toBeInTheDocument()
    expect(api.createOrder).toHaveBeenCalledExactlyOnceWith('card', true)
  },
)

test('does not reconcile an old mutation into a different account', async () => {
  serverItems = []
  const pending = deferred()
  api.addToCart.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  const { rerender } = render(<Shop />)
  await ready()
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  serverCode = 'EUR'
  serverItems = [lunar]
  rerender(<Shop owner={8} code="EUR" />)
  await ready()
  const reads = api.getCart.mock.calls.length
  await act(async () => pending.resolve())
  expect(api.getCart).toHaveBeenCalledTimes(reads)
  expect(screen.getByRole('heading', { name: 'Lunar' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Orbit' })).not.toBeInTheDocument()
})
