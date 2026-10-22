import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { CartContext } from '../src/cart/context'
import { CurrencyContext } from '../src/currency/context'
import { WalletContext } from '../src/wallet/context'
import OrdersProvider from '../src/orders/OrdersProvider'
import Library from '../src/pages/AccountPage/Library'
import AddToCartButton from '../src/components/Cart/AddToCartButton'
import { getOrders } from '../src/api/cart'
import { getGame } from '../src/api/catalog'
import { deferred } from './helpers'

vi.mock('../src/api/cart', async (original) => ({
  ...(await original()),
  getOrders: vi.fn(),
}))
vi.mock('../src/api/catalog', async (original) => ({
  ...(await original()),
  getGame: vi.fn(),
}))

const paidOrder = { id: 10, status: 'paid', items: [{ game_id: '1' }] }
const secondOrder = { id: 11, status: 'paid', items: [{ game_id: '2' }] }

beforeEach(() => {
  getOrders.mockReset().mockResolvedValue([paidOrder])
  getGame.mockReset().mockImplementation(async (id) => ({
    id,
    title: id === '1' ? 'Orbit' : 'Lunar',
  }))
})

function Account({ userId = 7, orderVersion = 0, lastOrder = null }) {
  return (
    <AuthContext.Provider
      value={{
        currentUser: userId == null ? null : { id: userId },
        isAuthenticated: userId != null,
      }}
    >
      <WalletContext.Provider value={{ loading: false, busy: false }}>
        <CurrencyContext.Provider value={{ code: 'USD' }}>
          <CartContext.Provider value={{ orderVersion, lastOrder, busy: false }}>
            <OrdersProvider>
              <Library />
              <AddToCartButton gameId="1" />
            </OrdersProvider>
          </CartContext.Provider>
        </CurrencyContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}

function focusWindow() {
  act(() => window.dispatchEvent(new Event('focus')))
}

test('keeps library cards, search and ownership during background refresh without refetching details', async () => {
  const user = userEvent.setup()
  render(<Account />)
  const card = await screen.findByRole('article', { name: 'Orbit' })
  await user.type(screen.getByRole('searchbox'), 'Orb')
  const refresh = deferred()
  getOrders.mockReturnValueOnce(refresh.promise)
  focusWindow()
  expect(screen.getByText('Loading library...')).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Orbit' })).toBe(card)
  expect(screen.getByRole('link', { name: 'View library' })).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('Orb')
  expect(getGame).toHaveBeenCalledTimes(1)
  await act(async () => refresh.resolve([paidOrder]))
  expect(screen.queryByText('Loading library...')).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Orbit' })).toBe(card)
  expect(getGame).toHaveBeenCalledTimes(1)
})

test('retains confirmed purchases after a failed refresh and applies refunds on retry', async () => {
  const user = userEvent.setup()
  render(<Account />)
  const card = await screen.findByRole('article', { name: 'Orbit' })
  getOrders.mockRejectedValueOnce(new Error('Orders temporarily unavailable'))
  focusWindow()
  expect(
    await screen.findByText('Could not load your purchases. Orders temporarily unavailable'),
  ).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Orbit' })).toBe(card)
  expect(screen.queryByText('Your library is empty.', { exact: false })).not.toBeInTheDocument()
  getOrders.mockResolvedValueOnce([{ ...paidOrder, status: 'refunded' }])
  await user.click(screen.getByRole('button', { name: 'Retry library' }))
  expect(await screen.findByText('Your library is empty.', { exact: false })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: 'Orbit' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
})

test('shows a new purchase immediately alongside existing games while order history catches up', async () => {
  const { rerender } = render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  const refresh = deferred()
  getOrders.mockReturnValueOnce(refresh.promise)
  rerender(<Account orderVersion={1} lastOrder={secondOrder} />)
  await screen.findByRole('article', { name: 'Lunar' })
  expect(screen.getByRole('article', { name: 'Orbit' })).toBeInTheDocument()
  await act(async () => refresh.resolve([secondOrder, paidOrder]))
  expect(screen.getAllByRole('article')).toHaveLength(2)
})

test('deduplicates paid purchases and excludes pending and refunded games', async () => {
  getOrders.mockResolvedValueOnce([
    paidOrder,
    { ...paidOrder, id: 12 },
    { ...secondOrder, status: 'pending' },
    { ...secondOrder, id: 13, status: 'refunded' },
  ])
  render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(getGame).toHaveBeenCalledTimes(1)
})

test('does not reuse purchases or late responses across sign-out and a new session', async () => {
  const { rerender } = render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  const oldRefresh = deferred()
  getOrders.mockReturnValueOnce(oldRefresh.promise)
  focusWindow()
  const oldSignal = getOrders.mock.calls.at(-1)[0]
  rerender(<Account userId={null} />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(oldSignal.aborted).toBe(true)
  const nextSession = deferred()
  getOrders.mockReturnValueOnce(nextSession.promise)
  rerender(<Account />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  await act(async () => oldRefresh.resolve([secondOrder]))
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  await act(async () => nextSession.resolve([]))
  expect(screen.getByText('Your library is empty.', { exact: false })).toBeInTheDocument()
})

test('ignores superseded refresh results and preserves the newest server ownership', async () => {
  render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  const older = deferred()
  const newer = deferred()
  getOrders.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
  focusWindow()
  const oldSignal = getOrders.mock.calls.at(-1)[0]
  focusWindow()
  expect(oldSignal.aborted).toBe(true)
  await act(async () => newer.resolve([secondOrder]))
  await screen.findByRole('article', { name: 'Lunar' })
  await act(async () => older.resolve([paidOrder]))
  expect(screen.queryByRole('article', { name: 'Orbit' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Lunar' })).toBeInTheDocument()
})

test('initial errors stay recoverable without showing an empty library', async () => {
  const user = userEvent.setup()
  getOrders.mockRejectedValueOnce(new Error('Cannot connect'))
  render(<Account />)
  expect(
    await screen.findByText('Could not load your purchases. Cannot connect'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Your library is empty.', { exact: false })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retry library' }))
  await screen.findByRole('article', { name: 'Orbit' })
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})
