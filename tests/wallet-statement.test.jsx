import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { apiRequest } from '../src/api/client'
import { getWalletTransactions } from '../src/api/wallet'
import { AuthContext } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import WalletSection from '../src/wallet/WalletSection'

vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
const row = {
  id: 1,
  amount: '10.00',
  balance_after: '100.00',
  currency: 'USD',
  transaction_type: 'deposit',
  description: 'First deposit',
  created_at: '2026-10-25T09:00:00Z',
}
const statement = (page = 1) => ({
  items: [{ ...row, id: page, description: `Statement page ${page}` }],
  total: 20,
  page,
  page_size: 10,
  total_pages: 2,
})
beforeEach(() => {
  apiRequest.mockReset().mockResolvedValue(statement())
})

test('uses the deployed page_size contract and preserves cancellation', async () => {
  const controller = new AbortController()
  await expect(
    getWalletTransactions({ page: 1, per_page: 10 }, controller.signal),
  ).resolves.toMatchObject({ per_page: 10, items: [expect.objectContaining({ amount: '10.00' })] })
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
    '/me/wallet/transactions?page=1&page_size=10',
    { signal: controller.signal },
  )
})

test.each([
  { page: 0 },
  { page: 1.5 },
  { page: Number.MAX_SAFE_INTEGER + 1 },
  { per_page: 0 },
  { per_page: 101 },
])('rejects invalid pagination before a request: %j', async (query) => {
  await expect(getWalletTransactions(query)).rejects.toThrow('Invalid transaction pagination')
  expect(apiRequest).not.toHaveBeenCalled()
})

test.each([
  { description: { text: 'Invalid description' } },
  { currency: ['USD'] },
  { created_at: 0 },
  { id: {} },
  { transaction_type: '  ' },
  { balance_after: '-1.00' },
])('rejects an unreadable transaction row: %j', async (change) => {
  apiRequest.mockResolvedValueOnce({ ...statement(), items: [{ ...row, ...change }] })
  await expect(getWalletTransactions()).rejects.toThrow('invalid transaction history')
})

test.each([
  { page: 2 },
  { page_size: 20 },
  { total: Number.MAX_SAFE_INTEGER + 1 },
  { total_pages: 17 },
  { items: [row, row] },
])('rejects inconsistent pagination or repeated rows: %j', async (change) => {
  apiRequest.mockResolvedValueOnce({ ...statement(), ...change })
  await expect(getWalletTransactions()).rejects.toThrow('invalid transaction history')
})

test('accepts an out-of-range empty response so the UI can recover after the history shrinks', async () => {
  apiRequest.mockResolvedValueOnce({ items: [], total: 1, page: 3, page_size: 10, total_pages: 1 })
  await expect(getWalletTransactions({ page: 3 })).resolves.toMatchObject({
    page: 3,
    total_pages: 1,
  })
})

test.each([0, 1])('accepts the empty-history page-count convention %s', async (total_pages) => {
  apiRequest.mockResolvedValueOnce({ items: [], total: 0, page: 1, per_page: 10, total_pages })
  await expect(getWalletTransactions()).resolves.toMatchObject({ items: [], per_page: 10 })
})

function History() {
  return (
    <AuthContext.Provider value={{ currentUser: { id: 7 } }}>
      <WalletContext.Provider
        value={{
          data: { balance: '100.00', currency: 'USD', is_frozen: false },
          revision: 1,
          refresh: vi.fn(),
        }}
      >
        <WalletSection />
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}

test('renders unknown operation types safely, including names inherited by ordinary objects', async () => {
  apiRequest.mockResolvedValueOnce({
    ...statement(),
    items: [{ ...row, transaction_type: '__proto__' }],
  })
  render(<History />)
  expect(await screen.findByText('Other transaction')).toBeInTheDocument()
  expect(screen.getByText('First deposit')).toBeInTheDocument()
})

test('shows an error for invalid rows and retries history without requesting a balance or payment', async () => {
  const user = userEvent.setup()
  apiRequest.mockResolvedValueOnce({
    ...statement(),
    items: [{ ...row, description: { text: 'Broken' } }],
  })
  render(<History />)
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid transaction history')
  await user.click(screen.getByRole('button', { name: 'Retry history' }))
  expect(await screen.findByText('Statement page 1')).toBeInTheDocument()
  expect(apiRequest.mock.calls.map(([path]) => path)).toEqual(
    Array(2).fill('/me/wallet/transactions?page=1&page_size=10'),
  )
})

test('retains the visible page when the server returns a different page, then retries the intended page', async () => {
  const user = userEvent.setup()
  render(<History />)
  await screen.findByText('Statement page 1')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid transaction history')
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  apiRequest.mockResolvedValueOnce(statement(2))
  await user.click(screen.getByRole('button', { name: 'Retry history' }))
  await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument())
  expect(apiRequest).toHaveBeenLastCalledWith('/me/wallet/transactions?page=2&page_size=10', {
    signal: expect.any(AbortSignal),
  })
})
