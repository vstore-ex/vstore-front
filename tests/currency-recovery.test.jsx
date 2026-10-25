import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import WalletProvider from '../src/wallet/WalletProvider'
import CurrencyProvider from '../src/currency/CurrencyProvider'
import CurrencySelector from '../src/currency/CurrencySelector'
import CartProvider from '../src/cart/CartProvider'
import WishlistProvider from '../src/wishlist/WishlistProvider'
import CartPage from '../src/pages/CartPage/CartPage'
import ResourceStatus from '../src/components/Catalog/ResourceStatus'
import useCatalogResource from '../src/hooks/useCatalogResource'
import { useWishlist } from '../src/wishlist/context'
import { useWallet } from '../src/wallet/context'
import { getWallet } from '../src/api/wallet'
import { getCurrencies, changeCurrency } from '../src/api/currency'
import { getCart, createOrder } from '../src/api/cart'
import { getWishlist } from '../src/api/wishlist'
import { getGames } from '../src/api/catalog'
import { deferred } from './helpers'

vi.mock('../src/api/wallet', async (original) => ({ ...(await original()), getWallet: vi.fn() }))
vi.mock('../src/api/currency', async (original) => ({
  ...(await original()),
  getCurrencies: vi.fn(),
  changeCurrency: vi.fn(),
}))
vi.mock('../src/api/cart', async (original) => ({
  ...(await original()),
  getCart: vi.fn(),
  createOrder: vi.fn(),
}))
vi.mock('../src/api/wishlist', async (original) => ({
  ...(await original()),
  getWishlist: vi.fn(),
}))
vi.mock('../src/api/catalog', async (original) => ({ ...(await original()), getGames: vi.fn() }))

const wallet = (currency = 'USD') => ({ balance: '100.00', currency, is_frozen: false })
let serverWallet
beforeEach(() => {
  serverWallet = wallet()
  getWallet.mockReset().mockImplementation(async () => serverWallet)
  getCurrencies.mockReset().mockResolvedValue([
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ])
  changeCurrency.mockReset().mockImplementation(async (code) => {
    serverWallet = wallet(code)
    throw new TypeError('Failed to fetch')
  })
  getCart.mockReset().mockImplementation(async () => ({
    items: [{ game_id: 'orbit', title: 'Orbit', price: '20.00' }],
    subtotal: '20.00',
    tax: '0.00',
    total: '20.00',
    currency: serverWallet.currency,
  }))
  getWishlist.mockReset().mockImplementation(async () => [
    {
      id: 'orbit',
      title: 'Orbit',
      currency: serverWallet.currency,
      price: serverWallet.currency === 'EUR' ? '€20.00' : '$20.00',
    },
  ])
  getGames.mockReset().mockImplementation(async (_query, _signal, currency) => [
    {
      id: 'orbit',
      title: 'Orbit',
      price: currency === 'EUR' ? '€20.00' : '$20.00',
    },
  ])
  createOrder.mockReset()
})
function Prices() {
  const resource = useCatalogResource('games')
  const wishlist = useWishlist()
  const wallet = useWallet()
  return (
    <>
      <CurrencySelector profile />
      <section aria-label="Catalog prices">
        <ResourceStatus resource={resource} label="catalog prices" />
        {resource.data?.map((game) => (
          <p key={game.id}>{game.price}</p>
        ))}
      </section>
      <output aria-label="Wishlist prices">
        {wishlist.items.map((item) => item.price).join(', ')}
      </output>
      <button onClick={wallet.refresh}>Refresh current wallet</button>
      <CartPage />
    </>
  )
}
function Store({ owner = 7 }) {
  return (
    <AuthContext.Provider
      value={{
        currentUser: owner == null ? null : { id: owner },
        status: owner == null ? 'anonymous' : 'authenticated',
      }}
    >
      <WalletProvider>
        <CurrencyProvider>
          <CartProvider>
            <WishlistProvider>
              <Prices />
            </WishlistProvider>
          </CartProvider>
        </CurrencyProvider>
      </WalletProvider>
    </AuthContext.Provider>
  )
}
const catalog = () => within(screen.getByRole('region', { name: 'Catalog prices' }))
async function ready() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled())
  expect(catalog().getByText('$20.00')).toBeInTheDocument()
}
async function convert(user) {
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Wallet and store currency' }),
    'EUR',
  )
  const dialog = within(screen.getByRole('dialog', { name: 'Change wallet currency?' }))
  await user.click(dialog.getByRole('button', { name: 'Confirm currency change' }))
  return dialog
}
function failNextRead() {
  getWallet.mockRejectedValueOnce({ status: 503, message: 'Wallet read unavailable' })
}

test('hides unconfirmed prices and blocks checkout if conversion and reconciliation both fail', async () => {
  const user = userEvent.setup()
  render(<Store />)
  await ready()
  failNextRead()
  const dialog = await convert(user)
  await dialog.findByText('Failed to fetch')
  await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  expect(catalog().queryByText('$20.00')).not.toBeInTheDocument()
  expect(catalog().getByRole('alert')).toHaveTextContent(
    'wallet service is temporarily unavailable',
  )
  expect(screen.getByLabelText('Wishlist prices')).toBeEmptyDOMElement()
  expect(screen.getByRole('button', { name: 'Check Out' })).toBeDisabled()
  expect(createOrder).not.toHaveBeenCalled()
  expect(changeCurrency).toHaveBeenCalledExactlyOnceWith('EUR')
})

test.each(['EUR', 'USD'])(
  'a read-only retry restores confirmed %s prices without repeating conversion',
  async (currency) => {
    const user = userEvent.setup()
    render(<Store />)
    await ready()
    failNextRead()
    const dialog = await convert(user)
    await dialog.findByText('Failed to fetch')
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    serverWallet = wallet(currency)
    await user.click(catalog().getByRole('button', { name: 'Retry catalog prices' }))
    const expected = currency === 'EUR' ? '€20.00' : '$20.00'
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled())
    expect(catalog().getByText(expected)).toBeInTheDocument()
    expect(screen.getByLabelText('Wishlist prices')).toHaveTextContent(expected)
    expect(changeCurrency).toHaveBeenCalledTimes(1)
    expect(createOrder).not.toHaveBeenCalled()
  },
)

test('a second failed balance read keeps the old prices unavailable', async () => {
  const user = userEvent.setup()
  render(<Store />)
  await ready()
  failNextRead()
  const dialog = await convert(user)
  await dialog.findByText('Failed to fetch')
  await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  failNextRead()
  await user.click(catalog().getByRole('button', { name: 'Retry catalog prices' }))
  await catalog().findByRole('button', { name: 'Retry catalog prices' })
  expect(catalog().queryByText('$20.00')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check Out' })).toBeDisabled()
  expect(changeCurrency).toHaveBeenCalledTimes(1)
})

test('superseding reconciliation cannot briefly re-enable old-currency checkout', async () => {
  const user = userEvent.setup()
  render(<Store />)
  await ready()
  const first = deferred(),
    second = deferred()
  getWallet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  await convert(user)
  await waitFor(() => expect(getWallet).toHaveBeenCalledTimes(2))
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(getWallet).toHaveBeenCalledTimes(3))
  await act(async () => first.reject(new DOMException('Aborted', 'AbortError')))
  expect(catalog().queryByText('$20.00')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check Out' })).toBeDisabled()
  await act(async () => second.resolve(wallet('EUR')))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled())
  expect(catalog().getByText('€20.00')).toBeInTheDocument()
})

test('a failed ordinary balance refresh does not block known catalog prices', async () => {
  const user = userEvent.setup()
  render(<Store />)
  await ready()
  failNextRead()
  await user.click(screen.getByRole('button', { name: 'Refresh current wallet' }))
  await screen.findByRole('button', { name: 'Refresh wallet' })
  expect(catalog().getByText('$20.00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled()
  expect(changeCurrency).not.toHaveBeenCalled()
})

test('currency uncertainty and late reads do not cross account boundaries', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<Store />)
  await ready()
  const oldRead = deferred()
  getWallet.mockReturnValueOnce(oldRead.promise)
  await convert(user)
  await waitFor(() => expect(getWallet).toHaveBeenCalledTimes(2))
  serverWallet = wallet('USD')
  rerender(<Store owner={8} />)
  await ready()
  await act(async () => oldRead.resolve(wallet('EUR')))
  expect(catalog().getByText('$20.00')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Check Out' })).toBeEnabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
