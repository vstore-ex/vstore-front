import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { CurrencyContext } from '../src/currency/context'
import WalletProvider from '../src/wallet/WalletProvider'
import { useWallet } from '../src/wallet/context'
import CartProvider from '../src/cart/CartProvider'
import { useCart } from '../src/cart/context'
import OrdersProvider from '../src/orders/OrdersProvider'
import CartPage from '../src/pages/CartPage/CartPage'
import Header from '../src/components/Header/Header'
import AddToCartButton from '../src/components/Cart/AddToCartButton'
import * as cartApi from '../src/api/cart'
import * as walletApi from '../src/api/wallet'
import { deferred } from './helpers'

vi.mock('../src/api/cart', async (original) => ({
  ...(await original()),
  getCart: vi.fn(),
  createOrder: vi.fn(),
  getOrders: vi.fn(),
}))
vi.mock('../src/api/wallet', async (original) => ({
  ...(await original()),
  getWallet: vi.fn(),
}))

const game = { game_id: '1', title: 'Orbit', price: '20.00' }
const initialCart = {
  items: [game],
  subtotal: '20.00',
  tax: '2.00',
  total: '22.00',
  currency: 'USD',
}
const wallet = { balance: '100.00', currency: 'USD', is_frozen: false }
const order = { id: 99, status: 'paid', items: [game], total: '22.00', currency: 'USD' }
const currency = {
  code: 'USD',
  currencies: [{ code: 'USD', name: 'US Dollar' }],
  switching: false,
  unavailable: '',
  disabled: false,
  loading: false,
}

beforeEach(() => {
  cartApi.getCart.mockReset().mockResolvedValue(initialCart)
  cartApi.createOrder.mockReset().mockResolvedValue(order)
  cartApi.getOrders.mockReset().mockResolvedValue([])
  walletApi.getWallet.mockReset().mockResolvedValue(wallet)
})

function Shopping() {
  const cart = useCart()
  const wallet = useWallet()
  return (
    <>
      <Header isAuthenticated cartCount={cart.count} />
      <AddToCartButton gameId="1" />
      <CartPage />
      {wallet.error && (
        <div role="alert">
          {wallet.error}
          <button onClick={wallet.refresh}>Retry wallet balance</button>
        </div>
      )}
    </>
  )
}

function Shop() {
  return (
    <AuthContext.Provider value={{ currentUser: { id: 7 }, isAuthenticated: true }}>
      <WalletProvider>
        <CurrencyContext.Provider value={currency}>
          <CartProvider>
            <OrdersProvider>
              <Shopping />
            </OrdersProvider>
          </CartProvider>
        </CurrencyContext.Provider>
      </WalletProvider>
    </AuthContext.Provider>
  )
}

async function openCheckout() {
  const user = userEvent.setup()
  render(<Shop />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Check Out' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Checkout' }))
  await user.click(dialog.getByRole('radio', { name: 'Wallet balance' }))
  await waitFor(() => expect(dialog.queryByText('Updating balance...')).not.toBeInTheDocument())
  await user.click(dialog.getByRole('checkbox'))
  return { user, dialog, submit: dialog.getByRole('button', { name: 'Place Order' }) }
}

test('confirms a paid wallet order immediately while the refreshed balance is still pending', async () => {
  const { user, dialog, submit } = await openCheckout()
  const payment = deferred()
  const balance = deferred()
  cartApi.createOrder.mockReturnValueOnce(payment.promise)
  walletApi.getWallet.mockReturnValueOnce(balance.promise)
  await user.click(submit)
  expect(dialog.getByRole('button', { name: 'Placing order...' })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.click(dialog.getByRole('button', { name: 'Placing order...' }))
  expect(cartApi.createOrder).toHaveBeenCalledTimes(1)
  expect(cartApi.createOrder).toHaveBeenCalledWith('wallet', true)
  cartApi.getOrders.mockResolvedValue([order])
  await act(async () => payment.resolve(order))
  expect(await screen.findByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('1 items in cart')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View library' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('Updating...')
  await act(async () => balance.resolve({ ...wallet, balance: '78.00' }))
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$78.00')
})

test('keeps order success when balance refresh fails and retries only the balance', async () => {
  const { user, submit } = await openCheckout()
  const balance = deferred()
  walletApi.getWallet.mockReturnValueOnce(balance.promise)
  await user.click(submit)
  expect(await screen.findByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
  await act(async () => balance.reject({ status: 503, message: 'Balance unavailable' }))
  expect(screen.getByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('Unavailable')
  walletApi.getWallet.mockResolvedValueOnce({ ...wallet, balance: '78.00' })
  await user.click(screen.getByRole('button', { name: 'Retry wallet balance' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$78.00'),
  )
  expect(cartApi.createOrder).toHaveBeenCalledTimes(1)
})

test('shows insufficient funds from checkout before a slow balance refresh finishes', async () => {
  const { user, dialog, submit } = await openCheckout()
  const balance = deferred()
  walletApi.getWallet.mockReturnValueOnce(balance.promise)
  cartApi.createOrder.mockRejectedValueOnce({ status: 400, message: 'insufficient wallet funds' })
  await user.click(submit)
  expect(
    await dialog.findByText('Insufficient wallet funds. Top up your wallet or choose a bank card.'),
  ).toBeInTheDocument()
  expect(dialog.getByRole('button', { name: 'Place Order' })).toBeDisabled()
  expect(screen.getByLabelText('1 items in cart')).toBeInTheDocument()
  await act(async () => balance.resolve({ ...wallet, balance: '5.00' }))
  expect(dialog.getByText('Insufficient wallet funds. You need $17.00 more.')).toBeInTheDocument()
  expect(cartApi.createOrder).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('heading', { name: 'Order #99' })).not.toBeInTheDocument()
})

test.each([
  [{ ...wallet, balance: '5.00' }, 'Insufficient wallet funds. You need $17.00 more.'],
  [{ ...wallet, is_frozen: true }, 'Your wallet is frozen. Choose a bank card or contact support.'],
  [
    { ...wallet, currency: 'EUR' },
    'Your cart currency has changed. Refresh the cart before paying.',
  ],
])(
  'blocks unsafe wallet payments and still allows choosing a bank card (%j)',
  async (balance, warning) => {
    walletApi.getWallet.mockResolvedValue(balance)
    const { user, dialog, submit } = await openCheckout()
    expect(dialog.getByText(warning)).toBeInTheDocument()
    expect(submit).toBeDisabled()
    await user.click(submit)
    expect(cartApi.createOrder).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('radio', { name: 'Bank card' }))
    expect(submit).toBeEnabled()
    await user.click(submit)
    expect(await screen.findByRole('heading', { name: 'Order #99' })).toBeInTheDocument()
    expect(cartApi.createOrder).toHaveBeenCalledWith('card', true)
    expect(walletApi.getWallet).toHaveBeenCalledTimes(2)
  },
)
