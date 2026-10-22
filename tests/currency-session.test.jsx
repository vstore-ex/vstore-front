import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { WalletContext, useWallet } from '../src/wallet/context'
import { useCurrency } from '../src/currency/context'
import { useCart } from '../src/cart/context'
import { useWishlist } from '../src/wishlist/context'
import WalletProvider from '../src/wallet/WalletProvider'
import CurrencyProvider from '../src/currency/CurrencyProvider'
import CurrencySelector from '../src/currency/CurrencySelector'
import CartProvider from '../src/cart/CartProvider'
import WishlistProvider from '../src/wishlist/WishlistProvider'
import { changeCurrency, getCurrencies } from '../src/api/currency'
import { getWallet } from '../src/api/wallet'
import { getCart } from '../src/api/cart'
import { getWishlist } from '../src/api/wishlist'
import { deferred } from './helpers'

vi.mock('../src/api/currency', async (importOriginal) => ({
  ...(await importOriginal()),
  getCurrencies: vi.fn(),
  changeCurrency: vi.fn(),
}))
vi.mock('../src/api/wallet', async (importOriginal) => ({
  ...(await importOriginal()),
  getWallet: vi.fn(),
}))
vi.mock('../src/api/cart', async (importOriginal) => ({
  ...(await importOriginal()),
  getCart: vi.fn(),
}))
vi.mock('../src/api/wishlist', async (importOriginal) => ({
  ...(await importOriginal()),
  getWishlist: vi.fn(),
}))

const wallet = (currency = 'USD', is_frozen = false) => ({
  balance: currency === 'EUR' ? '90.00' : '100.00',
  currency,
  is_frozen,
})
let serverWallet
beforeEach(() => {
  serverWallet = wallet()
  getCurrencies.mockReset().mockResolvedValue([
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ])
  changeCurrency.mockReset().mockImplementation(async (code) => {
    serverWallet = wallet(code)
    return serverWallet
  })
  getWallet.mockReset().mockImplementation(async () => serverWallet)
  getCart.mockReset().mockImplementation(async () => ({
    items: [{ game_id: 'orbit', title: 'Orbit', price: serverWallet.balance }],
    subtotal: serverWallet.balance,
    tax: '0.00',
    total: serverWallet.balance,
    currency: serverWallet.currency,
  }))
  getWishlist.mockReset().mockImplementation(async () => [
    {
      id: 'orbit',
      title: 'Orbit',
      price: serverWallet.currency === 'EUR' ? '€90.00' : '$100.00',
      currency: serverWallet.currency,
    },
  ])
})
function Settings({ owner = 7, code = 'USD', frozen = false }) {
  return (
    <AuthContext.Provider
      value={{
        currentUser: owner == null ? null : { id: owner },
        status: owner == null ? 'anonymous' : 'authenticated',
      }}
    >
      <WalletContext.Provider
        value={{
          data: owner == null ? null : wallet(code, frozen),
          loading: false,
          busy: false,
          error: '',
          changeCurrency,
          refresh: vi.fn(),
        }}
      >
        <CurrencyProvider>
          <CurrencySelector profile />
        </CurrencyProvider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
const confirmation = () => screen.getByRole('dialog', { name: 'Change wallet currency?' })
async function chooseEuro(user) {
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Wallet and store currency' }),
    'EUR',
  )
  return within(confirmation())
}

describe('currency confirmation scope (#75)', () => {
  test('asks for confirmation and cancellation never converts the balance', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    const dialog = await chooseEuro(user)
    expect(dialog.getByText(/current server exchange rate/)).toBeInTheDocument()
    expect(changeCurrency).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(changeCurrency).not.toHaveBeenCalled()
  })

  test('requires a fresh choice after switching accounts', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Settings />)
    await chooseEuro(user)
    rerender(<Settings owner={8} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(changeCurrency).not.toHaveBeenCalled()
    const dialog = await chooseEuro(user)
    await user.click(dialog.getByRole('button', { name: 'Confirm currency change' }))
    await waitFor(() => expect(changeCurrency).toHaveBeenCalledExactlyOnceWith('EUR'))
  })

  test('does not resurrect confirmation after signing out and back in as the same user', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Settings />)
    await chooseEuro(user)
    rerender(<Settings owner={null} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Settings />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(changeCurrency).not.toHaveBeenCalled()
  })

  test('invalidates a quote when the source currency changes elsewhere', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Settings />)
    await chooseEuro(user)
    rerender(<Settings code="EUR" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Settings code="USD" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(changeCurrency).not.toHaveBeenCalled()
  })

  test('shows why a frozen wallet cannot be converted and blocks the request', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Settings />)
    await chooseEuro(user)
    rerender(<Settings frozen />)
    const dialog = within(confirmation())
    expect(dialog.getByRole('alert')).toHaveTextContent(/frozen/i)
    expect(dialog.getByRole('button', { name: 'Confirm currency change' })).toBeDisabled()
    await user.click(dialog.getByRole('button', { name: 'Confirm currency change' }))
    expect(changeCurrency).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('a late conversion response cannot close another user’s new confirmation', async () => {
    const pending = deferred()
    changeCurrency.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    const { rerender } = render(<Settings />)
    const first = await chooseEuro(user)
    await user.click(first.getByRole('button', { name: 'Confirm currency change' }))
    rerender(<Settings owner={8} />)
    await chooseEuro(user)
    await act(async () => pending.resolve(wallet('EUR')))
    expect(confirmation()).toBeInTheDocument()
    expect(changeCurrency).toHaveBeenCalledTimes(1)
  })
})

function Prices() {
  const currency = useCurrency(),
    walletState = useWallet(),
    cart = useCart(),
    wishlist = useWishlist()
  return (
    <>
      <CurrencySelector profile />
      <output aria-label="Wallet">
        {currency.code} {walletState.data?.balance}
      </output>
      <output aria-label="Cart">
        {cart.pricesReady ? `${cart.currency} ${cart.total}` : 'Updating cart'}
      </output>
      <output aria-label="Wishlist">
        {wishlist.loading
          ? 'Updating wishlist'
          : wishlist.items.map((item) => `${item.currency} ${item.price}`).join(', ')}
      </output>
    </>
  )
}
function StorePrices() {
  return (
    <AuthContext.Provider value={{ currentUser: { id: 7 }, status: 'authenticated' }}>
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
describe('currency conversion with shopping providers (#75)', () => {
  test('updates the wallet and refreshes cart/wishlist without displaying stale prices', async () => {
    const user = userEvent.setup()
    render(<StorePrices />)
    await waitFor(() => expect(screen.getByLabelText('Cart')).toHaveTextContent('USD 100.00'))
    expect(screen.getByLabelText('Wishlist')).toHaveTextContent('USD $100.00')
    const nextCart = deferred(),
      nextWishlist = deferred()
    getCart.mockReturnValueOnce(nextCart.promise)
    getWishlist.mockReturnValueOnce(nextWishlist.promise)
    const dialog = await chooseEuro(user)
    await user.click(dialog.getByRole('button', { name: 'Confirm currency change' }))
    await waitFor(() => expect(screen.getByLabelText('Wallet')).toHaveTextContent('EUR 90.00'))
    expect(screen.getByLabelText('Cart')).toHaveTextContent('Updating cart')
    expect(screen.getByLabelText('Wishlist')).toHaveTextContent('Updating wishlist')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () => {
      nextCart.resolve({
        items: [],
        subtotal: '90.00',
        tax: '0.00',
        total: '90.00',
        currency: 'EUR',
      })
      nextWishlist.resolve([{ id: 'orbit', title: 'Orbit', price: '€90.00', currency: 'EUR' }])
    })
    expect(screen.getByLabelText('Cart')).toHaveTextContent('EUR 90.00')
    expect(screen.getByLabelText('Wishlist')).toHaveTextContent('EUR €90.00')
    expect(changeCurrency).toHaveBeenCalledExactlyOnceWith('EUR')
  })

  test('reconciles a server-side freeze without changing prices or retrying the mutation', async () => {
    changeCurrency.mockImplementationOnce(async () => {
      serverWallet = wallet('USD', true)
      throw { status: 403, message: 'wallet is frozen' }
    })
    const user = userEvent.setup()
    render(<StorePrices />)
    await waitFor(() => expect(screen.getByLabelText('Cart')).toHaveTextContent('USD 100.00'))
    const dialog = await chooseEuro(user)
    await user.click(dialog.getByRole('button', { name: 'Confirm currency change' }))
    await waitFor(() =>
      expect(dialog.getByRole('button', { name: 'Confirm currency change' })).toBeDisabled(),
    )
    await waitFor(() => expect(getWallet).toHaveBeenCalledTimes(2))
    expect(await dialog.findByText(/Your wallet is frozen/)).toBeInTheDocument()
    expect(screen.getByLabelText('Wallet')).toHaveTextContent('USD 100.00')
    expect(changeCurrency).toHaveBeenCalledTimes(1)
  })
})
