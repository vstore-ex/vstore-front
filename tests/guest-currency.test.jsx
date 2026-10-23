import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import CurrencyProvider from '../src/currency/CurrencyProvider'
import CurrencySelector from '../src/currency/CurrencySelector'
import useCatalogResource from '../src/hooks/useCatalogResource'
import { deferred, jsonResponse } from './helpers'

const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', is_active: true },
  { code: 'EUR', name: 'Euro', symbol: '€', is_active: true },
  { code: 'JPY', name: 'Yen', symbol: '¥', is_active: true },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', is_active: false },
]
let requests, listResponse, gameResponse
const refreshWallet = vi.fn()
beforeEach(() => {
  requests = []
  refreshWallet.mockReset()
  listResponse = () => jsonResponse(currencies)
  gameResponse = (currency) =>
    jsonResponse([{ id: 'orbit', title: 'Orbit', price: '12.00', currency }])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, options) => {
      const url = new URL(input, window.location.origin)
      requests.push({ path: url.pathname, code: url.searchParams.get('currency'), options })
      if (url.pathname === '/api/v1/currencies') return listResponse()
      if (url.pathname === '/api/v1/games/') return gameResponse(url.searchParams.get('currency'))
      throw new Error('Unexpected request: ' + input)
    }),
  )
})
afterEach(() => vi.restoreAllMocks())
const catalogRequests = () => requests.filter(({ path }) => path === '/api/v1/games/')

function Catalog() {
  const resource = useCatalogResource('games', 'skip=0&limit=1')
  return (
    <section aria-label="Catalog">
      {resource.loading && <p role="status">Loading catalog...</p>}
      {resource.error && (
        <div role="alert">
          {resource.error.message}
          <button onClick={resource.retry}>Retry catalog</button>
        </div>
      )}
      {resource.data?.map((game) => (
        <p key={game.id}>
          {game.title}: {game.price}
        </p>
      ))}
    </section>
  )
}
function Store({ signedIn = false, status = signedIn ? 'authenticated' : 'anonymous' }) {
  return (
    <AuthContext.Provider value={{ currentUser: signedIn ? { id: 7 } : null, status }}>
      <WalletContext.Provider
        value={{
          data: signedIn ? { currency: 'EUR', balance: '50.00' } : null,
          refresh: refreshWallet,
        }}
      >
        <CurrencyProvider>
          <CurrencySelector />
          <Catalog />
        </CurrencyProvider>
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
async function choose(code) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Choose currency' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Store currency' }), code)
}

test('waits for active currencies before using a saved preference in catalog requests', async () => {
  localStorage.setItem('vstore:currency', 'EUR')
  const pending = deferred()
  listResponse = () => pending.promise
  render(<Store />)
  await act(async () => {})
  expect(catalogRequests()).toHaveLength(0)
  expect(screen.getByText('Loading catalog...')).toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse(currencies)))
  expect(await screen.findByText('Orbit: €12.00')).toBeInTheDocument()
  expect(catalogRequests().map(({ code }) => code)).toEqual(['EUR'])
})

test.each(['ZZZ', 'TRY', '$', ''])(
  'repairs unsupported or invalid saved preference %j and only requests active prices',
  async (saved) => {
    localStorage.setItem('vstore:currency', saved)
    render(<Store />)
    expect(await screen.findByText('Orbit: $12.00')).toBeInTheDocument()
    expect(catalogRequests().every(({ code }) => code === 'USD')).toBe(true)
    expect(localStorage.getItem('vstore:currency')).toBe('USD')
  },
)

test('falls back to the first active currency when USD is unavailable', async () => {
  localStorage.setItem('vstore:currency', 'USD')
  listResponse = () => jsonResponse(currencies.filter(({ code }) => code !== 'USD'))
  render(<Store />)
  expect(await screen.findByText('Orbit: €12.00')).toBeInTheDocument()
  expect(catalogRequests().map(({ code }) => code)).toEqual(['EUR'])
  expect(localStorage.getItem('vstore:currency')).toBe('EUR')
})

test.each([503, 200])(
  'offers a catalog retry when currencies fail or contain no active choices (%s)',
  async (status) => {
    localStorage.setItem('vstore:currency', 'ZZZ')
    listResponse = () =>
      jsonResponse(status === 503 ? { detail: 'Currency service unavailable' } : [], status)
    const user = userEvent.setup()
    render(<Store />)
    await screen.findByRole('button', { name: 'Retry catalog' })
    expect(catalogRequests()).toHaveLength(0)
    expect(screen.queryByText('Loading catalog...')).not.toBeInTheDocument()
    listResponse = () => jsonResponse(currencies)
    await user.click(screen.getByRole('button', { name: 'Retry catalog' }))
    expect(await screen.findByText('Orbit: $12.00')).toBeInTheDocument()
    expect(refreshWallet).not.toHaveBeenCalled()
  },
)

test('persists selection across a remount and exposes only active currencies with their names and symbols', async () => {
  const first = render(<Store />)
  await screen.findByText('Orbit: $12.00')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Choose currency' }))
  expect(screen.getByRole('option', { name: 'EUR · € · Euro' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: /TRY/ })).not.toBeInTheDocument()
  await user.selectOptions(screen.getByRole('combobox'), 'JPY')
  await screen.findByText('Orbit: ¥12')
  expect(localStorage.getItem('vstore:currency')).toBe('JPY')
  first.unmount()
  render(<Store />)
  await screen.findByText('Orbit: ¥12')
  expect(catalogRequests().at(-1).code).toBe('JPY')
})

test('synchronizes another tab selection and safely repairs an inactive currency', async () => {
  render(<Store />)
  await screen.findByText('Orbit: $12.00')
  act(() => {
    localStorage.setItem('vstore:currency', 'EUR')
    window.dispatchEvent(new StorageEvent('storage', { key: 'vstore:currency' }))
  })
  await screen.findByText('Orbit: €12.00')
  act(() => {
    localStorage.setItem('vstore:currency', 'TRY')
    window.dispatchEvent(new StorageEvent('storage', { key: 'vstore:currency' }))
  })
  await screen.findByText('Orbit: $12.00')
  expect(localStorage.getItem('vstore:currency')).toBe('USD')
  expect(catalogRequests().some(({ code }) => code === 'TRY')).toBe(false)
})

test('keeps selection usable when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage denied')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage denied')
  })
  render(<Store />)
  await screen.findByText('Orbit: $12.00')
  await choose('EUR')
  await screen.findByText('Orbit: €12.00')
  expect(catalogRequests().at(-1).code).toBe('EUR')
})

test('keeps signed-in pricing tied to the wallet even if the public currency list fails', async () => {
  localStorage.setItem('vstore:currency', 'JPY')
  listResponse = () => jsonResponse({ detail: 'Currency service unavailable' }, 503)
  render(<Store signedIn />)
  await screen.findByText('Orbit: €12.00')
  expect(catalogRequests().map(({ code }) => code)).toEqual(['EUR'])
  expect(localStorage.getItem('vstore:currency')).toBe('JPY')
})

test('discards an older catalog response after switching currency', async () => {
  const oldPrices = deferred()
  gameResponse = (code) =>
    code === 'USD'
      ? oldPrices.promise
      : jsonResponse([{ id: 'orbit', title: 'Orbit', price: '12', currency: code }])
  render(<Store />)
  await waitFor(() => expect(catalogRequests()).toHaveLength(1))
  await choose('EUR')
  await screen.findByText('Orbit: €12.00')
  await act(async () =>
    oldPrices.resolve(
      jsonResponse([{ id: 'orbit', title: 'Orbit', price: '99', currency: 'USD' }]),
    ),
  )
  expect(screen.getByText('Orbit: €12.00')).toBeInTheDocument()
  expect(screen.queryByText('Orbit: $99.00')).not.toBeInTheDocument()
})
