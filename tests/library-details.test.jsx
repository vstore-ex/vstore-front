import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { OrdersContext } from '../src/orders/context'
import { WalletContext } from '../src/wallet/context'
import { CurrencyContext } from '../src/currency/context'
import Library from '../src/pages/AccountPage/Library'
import { getGame } from '../src/api/catalog'
import { deferred } from './helpers'

vi.mock('../src/api/catalog', async (original) => ({ ...(await original()), getGame: vi.fn() }))
const game = (id) => ({ id, title: id === '1' ? 'Orbit' : id === '2' ? 'Lunar' : `Title ${id}` })
beforeEach(() => {
  getGame.mockReset().mockImplementation(async (id) => game(id))
})

function Account({ owner = 7, ids = ['1', '2'], code = 'USD' }) {
  return (
    <AuthContext.Provider value={{ currentUser: owner == null ? null : { id: owner } }}>
      <WalletContext.Provider value={{ loading: false, busy: false }}>
        <CurrencyContext.Provider value={{ code }}>
          <OrdersContext.Provider value={{ ownedIds: ids, loading: false, error: '' }}>
            <Library />
          </OrdersContext.Provider>
        </CurrencyContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}

test('shows completed cards while another game is still loading', async () => {
  const slow = deferred()
  getGame.mockImplementation((id) => (id === '2' ? slow.promise : Promise.resolve(game(id))))
  render(<Account />)
  expect(await screen.findByRole('article', { name: 'Orbit' })).toBeInTheDocument()
  expect(screen.getByText('Loading game details...')).toBeInTheDocument()
  await act(async () => slow.resolve(game('2')))
  expect(screen.getByRole('article', { name: 'Lunar' })).toBeInTheDocument()
  expect(screen.queryByText('Loading game details...')).not.toBeInTheDocument()
})

test('keeps existing cards and the search field during a new purchase without refetching them', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<Account ids={['1']} />)
  const card = await screen.findByRole('article', { name: 'Orbit' })
  await user.type(screen.getByRole('searchbox'), 'Orb')
  const slow = deferred()
  getGame.mockImplementation((id) => (id === '2' ? slow.promise : Promise.resolve(game(id))))
  rerender(<Account ids={['1', '2']} />)
  expect(screen.getByRole('article', { name: 'Orbit' })).toBe(card)
  expect(screen.getByRole('searchbox')).toHaveValue('Orb')
  await waitFor(() => expect(getGame).toHaveBeenCalledTimes(2))
  expect(getGame.mock.calls.map(([id]) => id)).toEqual(['1', '2'])
  await act(async () => slow.resolve(game('2')))
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(screen.getAllByRole('article')).toHaveLength(2)
})

test('retries only failed details while preserving good cards and unavailable-game placeholders', async () => {
  const user = userEvent.setup()
  getGame.mockImplementation(async (id) => {
    if (id === '2') throw new Error('Network unavailable')
    if (id === '3') throw { status: 404 }
    return game(id)
  })
  render(<Account ids={['1', '2', '3']} />)
  const card = await screen.findByRole('article', { name: 'Orbit' })
  const retry = await screen.findByRole('button', { name: 'Retry game details' })
  await waitFor(() => expect(retry).toBeEnabled())
  expect(screen.getByText('No longer available in the catalog')).toBeInTheDocument()
  const pending = deferred()
  getGame.mockImplementation((id) => (id === '2' ? pending.promise : Promise.resolve(game(id))))
  await user.click(retry)
  expect(screen.getByRole('article', { name: 'Orbit' })).toBe(card)
  expect(getGame.mock.calls.map(([id]) => id)).toEqual(['1', '2', '3', '2'])
  await act(async () => pending.resolve(game('2')))
  expect(screen.getByRole('article', { name: 'Lunar' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry game details' })).not.toBeInTheDocument()
})

test('removes refunded games immediately and ignores their late detail responses', async () => {
  const pending = deferred()
  getGame.mockImplementation((id) => (id === '2' ? pending.promise : Promise.resolve(game(id))))
  const { rerender } = render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  const signal = getGame.mock.calls.find(([id]) => id === '2')[1]
  rerender(<Account ids={['1']} />)
  await waitFor(() => expect(signal.aborted).toBe(true))
  await act(async () => pending.resolve(game('2')))
  expect(screen.queryByRole('article', { name: 'Lunar' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(getGame.mock.calls.filter(([id]) => id === '1')).toHaveLength(1)
})

test('does not announce no matches while matching details are still pending', async () => {
  const user = userEvent.setup()
  const pending = deferred()
  getGame.mockImplementation((id) => (id === '2' ? pending.promise : Promise.resolve(game(id))))
  render(<Account />)
  await screen.findByRole('article', { name: 'Orbit' })
  await user.type(screen.getByRole('searchbox'), 'Lunar')
  expect(screen.queryByText('No games in your library match this search.')).not.toBeInTheDocument()
  await act(async () => pending.resolve(game('2')))
  expect(screen.getByRole('article', { name: 'Lunar' })).toBeInTheDocument()
})

test('keeps the four-request concurrency limit and fills cards as responses arrive', async () => {
  const requests = new Map()
  getGame.mockImplementation((id) => {
    const request = deferred()
    requests.set(id, request)
    return request.promise
  })
  render(<Account ids={['1', '2', '3', '4', '5', '6']} />)
  expect(getGame).toHaveBeenCalledTimes(4)
  await act(async () => requests.get('1').resolve(game('1')))
  expect(screen.getByRole('article', { name: 'Orbit' })).toBeInTheDocument()
  expect(getGame).toHaveBeenCalledTimes(5)
  await act(async () => requests.get('2').resolve(game('2')))
  expect(getGame).toHaveBeenCalledTimes(6)
  await act(async () => {
    for (const id of ['3', '4', '5', '6']) requests.get(id).resolve(game(id))
  })
  expect(screen.getAllByRole('article')).toHaveLength(6)
})

test('discards cached cards and search across users even when they own the same games', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<Account ids={['1']} />)
  await screen.findByRole('article', { name: 'Orbit' })
  await user.type(screen.getByRole('searchbox'), 'Orb')
  const pending = deferred()
  getGame.mockReturnValueOnce(pending.promise)
  rerender(<Account owner={8} ids={['1']} />)
  expect(screen.queryByRole('article', { name: 'Orbit' })).not.toBeInTheDocument()
  await act(async () => pending.resolve(game('1')))
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(getGame).toHaveBeenCalledTimes(2)
})

test('invalidates cached details on a currency change and ignores the earlier response', async () => {
  const pending = deferred()
  getGame.mockReturnValueOnce(pending.promise)
  const { rerender } = render(<Account ids={['1']} />)
  const oldSignal = getGame.mock.calls[0][1]
  getGame.mockResolvedValueOnce({ id: '1', title: 'Updated Orbit' })
  rerender(<Account ids={['1']} code="EUR" />)
  expect(await screen.findByRole('article', { name: 'Updated Orbit' })).toBeInTheDocument()
  await act(async () => pending.resolve(game('1')))
  expect(oldSignal.aborted).toBe(true)
  expect(screen.queryByRole('article', { name: 'Orbit' })).not.toBeInTheDocument()
  expect(getGame.mock.calls.at(-1)[2]).toBe('EUR')
})
