import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import { CurrencyContext } from '../src/currency/context'
import { CartContext } from '../src/cart/context'
import { OrdersContext } from '../src/orders/context'
import WishlistProvider from '../src/wishlist/WishlistProvider'
import { useWishlist } from '../src/wishlist/context'
import Header from '../src/components/Header/Header'
import WishlistButton from '../src/components/Wishlist/WishlistButton'
import WishlistPage from '../src/pages/WishlistPage/WishlistPage'
import * as api from '../src/api/wishlist'
import { deferred } from './helpers'

vi.mock('../src/api/wishlist', async (original) => ({
  ...(await original()),
  getWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}))
let serverCode, serverIds
function wishlistData(code = serverCode, ids = serverIds) {
  return ids.map((id) => ({
    id,
    title: id === '1' ? 'Orbit' : 'Lunar',
    price: code === 'EUR' ? '€20.00' : '$20.00',
    currency: code,
    image: '',
    tags: [],
    type: 'Base game',
  }))
}
beforeEach(() => {
  serverCode = 'USD'
  serverIds = ['1', '2']
  for (const fn of Object.values(api).filter(vi.isMockFunction)) fn.mockReset()
  api.getWishlist.mockImplementation(async () => wishlistData())
})
function Shopping() {
  const wishlist = useWishlist()
  return (
    <>
      <Header isAuthenticated wishlistCount={wishlist.count} />
      <section aria-label="Game actions">
        <WishlistButton gameId="1" />
      </section>
      <WishlistPage />
    </>
  )
}
function Shop({ code = 'USD', owner = 7, orderVersion = 0 }) {
  return (
    <AuthContext.Provider value={{ currentUser: { id: owner }, isAuthenticated: true }}>
      <WalletContext.Provider value={{ data: { balance: '100', currency: code } }}>
        <CurrencyContext.Provider
          value={{
            code,
            currencies: [{ code, name: code }],
            switching: false,
            unavailable: '',
            refreshWallet: vi.fn(),
          }}
        >
          <CartContext.Provider value={{ orderVersion, items: [], loading: false, busy: false }}>
            <OrdersContext.Provider value={{ ownedIds: [], loading: false, error: '' }}>
              <WishlistProvider>
                <Shopping />
              </WishlistProvider>
            </OrdersContext.Provider>
          </CartContext.Provider>
        </CurrencyContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
const actions = () => within(screen.getByRole('region', { name: 'Game actions' }))
async function ready() {
  await waitFor(() => expect(screen.queryByText('Loading wishlist...')).not.toBeInTheDocument())
}

test.each(['add', 'remove', 'remove last'])(
  'reconciles a pending %s after currency changes without stale prices or endless loading',
  async (action) => {
    serverIds = action === 'add' ? [] : action === 'remove' ? ['1', '2'] : ['1']
    const pending = deferred()
    const mutation = action === 'add' ? api.addToWishlist : api.removeFromWishlist
    mutation.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    const { rerender } = render(<Shop />)
    await ready()
    await user.click(
      action === 'add'
        ? actions().getByRole('button', { name: 'Wishlist' })
        : screen.getAllByRole('button', { name: 'Remove' })[0],
    )
    serverCode = 'EUR'
    rerender(<Shop code="EUR" />)
    await ready()
    serverIds = action === 'add' ? ['1'] : action === 'remove' ? ['2'] : []
    await act(async () => pending.resolve())
    await ready()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mutation).toHaveBeenCalledExactlyOnceWith('1')
    if (serverIds.length) {
      expect(screen.getByLabelText('1 items in wishlist')).toBeInTheDocument()
      expect(
        within(screen.getByRole('region', { name: 'Wishlist items' })).getByText('€20.00'),
      ).toBeInTheDocument()
    } else {
      expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument()
      expect(screen.queryByLabelText(/items in wishlist/)).not.toBeInTheDocument()
    }
    if (action === 'add')
      expect(actions().getByRole('link', { name: 'In your wishlist' })).toBeInTheDocument()
  },
)

test.each([400, 404])(
  'reconciles a late mutation error in the new currency (%s)',
  async (status) => {
    serverIds = status === 400 ? [] : ['1']
    const pending = deferred()
    const mutation = status === 400 ? api.addToWishlist : api.removeFromWishlist
    mutation.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    const { rerender } = render(<Shop />)
    await ready()
    await user.click(
      status === 400
        ? actions().getByRole('button', { name: 'Wishlist' })
        : screen.getByRole('button', { name: 'Remove' }),
    )
    serverCode = 'EUR'
    rerender(<Shop code="EUR" />)
    await ready()
    serverIds = ['2']
    await act(async () =>
      pending.reject({ status, message: status === 400 ? 'already in wishlist' : 'not found' }),
    )
    expect(screen.getByRole('heading', { name: 'Lunar' })).toBeInTheDocument()
    expect(screen.getByLabelText('1 items in wishlist')).toBeInTheDocument()
    expect(
      screen.getAllByText(
        status === 400
          ? 'This game is already in your wishlist.'
          : 'This game is no longer available in your wishlist or catalog.',
      ).length,
    ).toBeGreaterThan(0)
    expect(mutation).toHaveBeenCalledTimes(1)
  },
)

test('ignores a superseded old-currency read after mutation reconciliation succeeds', async () => {
  serverIds = []
  const pending = deferred(),
    oldRead = deferred()
  api.addToWishlist.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  const { rerender } = render(<Shop />)
  await ready()
  await user.click(actions().getByRole('button', { name: 'Wishlist' }))
  api.getWishlist.mockReturnValueOnce(oldRead.promise)
  await act(async () => pending.resolve())
  serverCode = 'EUR'
  serverIds = ['1']
  rerender(<Shop code="EUR" />)
  await ready()
  expect(screen.getByText('€20.00')).toBeInTheDocument()
  await act(async () => oldRead.resolve(wishlistData('USD', ['2'])))
  expect(screen.getByRole('heading', { name: 'Orbit' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lunar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('does not refresh another account after an old mutation completes', async () => {
  serverIds = []
  const pending = deferred()
  api.addToWishlist.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  const { rerender } = render(<Shop />)
  await ready()
  await user.click(actions().getByRole('button', { name: 'Wishlist' }))
  serverCode = 'EUR'
  serverIds = ['2']
  rerender(<Shop code="EUR" owner={8} />)
  await ready()
  const reads = api.getWishlist.mock.calls.length
  await act(async () => pending.resolve())
  expect(api.getWishlist).toHaveBeenCalledTimes(reads)
  expect(screen.getByRole('heading', { name: 'Lunar' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Orbit' })).not.toBeInTheDocument()
})

test('still exposes genuinely mismatched prices and permits a read-only retry', async () => {
  serverCode = 'EUR'
  serverIds = []
  const user = userEvent.setup()
  render(<Shop code="EUR" />)
  await ready()
  api.getWishlist.mockResolvedValueOnce(wishlistData('USD', ['1']))
  await user.click(actions().getByRole('button', { name: 'Wishlist' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Wishlist prices do not match your wallet currency.',
  )
  serverIds = ['1']
  await user.click(screen.getByRole('button', { name: 'Retry wishlist' }))
  await screen.findByText('€20.00')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api.addToWishlist).toHaveBeenCalledTimes(1)
})
