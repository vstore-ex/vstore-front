import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { WalletContext } from '../src/wallet/context'
import WalletSection from '../src/wallet/WalletSection'
import { getWalletTransactions } from '../src/api/wallet'
import { deferred } from './helpers'

vi.mock('../src/api/wallet', async (importOriginal) => ({
  ...(await importOriginal()),
  getWalletTransactions: vi.fn(),
}))

const transaction = (id, description, currency = 'USD', amount = '10.00') => ({
  id,
  description,
  currency,
  amount,
  balance_after: '100.00',
  transaction_type: amount.startsWith('-') ? 'purchase' : 'refund',
  created_at: '2026-10-22T09:00:00Z',
})
const statement = (page = 1, total = 30, label = 'Reader') => ({
  items: page <= Math.ceil(total / 10) ? [transaction(page, `${label} page ${page}`)] : [],
  total,
  page,
  per_page: 10,
  total_pages: Math.ceil(total / 10),
})
beforeEach(() => {
  getWalletTransactions.mockReset().mockImplementation(async ({ page }) => statement(page))
})
function AccountWallet({ owner = 7, revision = 1 }) {
  return (
    <AuthContext.Provider value={{ currentUser: owner == null ? null : { id: owner } }}>
      <WalletContext.Provider
        value={{
          data: owner == null ? null : { balance: '100.00', currency: 'USD', is_frozen: false },
          revision,
          loading: false,
          busy: false,
          error: '',
          refresh: vi.fn(),
          topUp: vi.fn(),
        }}
      >
        <WalletSection />
      </WalletContext.Provider>
    </AuthContext.Provider>
  )
}
const history = () => within(screen.getByRole('region', { name: 'Wallet transactions' }))

describe('wallet transaction history (#74)', () => {
  test('does not fetch or display private history for a guest', () => {
    render(<AccountWallet owner={null} />)
    expect(getWalletTransactions).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'My wallet' })).not.toBeInTheDocument()
  })

  test('shows signed amounts in each transaction currency and readable operation labels', async () => {
    getWalletTransactions.mockResolvedValueOnce({
      ...statement(1, 2),
      items: [
        transaction(1, 'Returned game', 'EUR', '25.00'),
        transaction(2, 'Bought game', 'JPY', '-1000.00'),
      ],
    })
    render(<AccountWallet />)
    await screen.findByText('Returned game')
    expect(history().getByText('+€25.00').closest('td')).toHaveClass('wallet-credit')
    expect(history().getByText('-¥1,000').closest('td')).toHaveClass('wallet-debit')
    expect(history().getByText('Refund')).toBeInTheDocument()
    expect(history().getByText('Game purchase')).toBeInTheDocument()
    expect(history().getAllByRole('columnheader')).toHaveLength(4)
    expect(getWalletTransactions).toHaveBeenCalledWith(
      { page: 1, per_page: 10 },
      expect.any(AbortSignal),
    )
  })

  test('retains the visible page during loading and failure, then retries the requested page', async () => {
    const next = deferred()
    const user = userEvent.setup()
    render(<AccountWallet />)
    await screen.findByText('Reader page 1')
    getWalletTransactions.mockReturnValueOnce(next.promise)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Reader page 1')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await act(async () => next.reject({ status: 503 }))
    expect(screen.getByRole('alert')).toHaveTextContent('wallet service is temporarily unavailable')
    expect(screen.getByText('Reader page 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry history' }))
    expect(await screen.findByText('Reader page 2')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.queryByText('Reader page 1')).not.toBeInTheDocument()
  })

  test('clears history and pagination immediately on an account change, ignoring late responses', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AccountWallet />)
    await screen.findByText('Reader page 1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Reader page 2')
    const oldPage = deferred(),
      newPage = deferred()
    getWalletTransactions.mockReturnValueOnce(oldPage.promise).mockReturnValueOnce(newPage.promise)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const oldSignal = getWalletTransactions.mock.calls.at(-1)[1]
    rerender(<AccountWallet owner={8} />)
    expect(screen.queryByText('Reader page 2')).not.toBeInTheDocument()
    expect(oldSignal.aborted).toBe(true)
    expect(getWalletTransactions).toHaveBeenLastCalledWith(
      { page: 1, per_page: 10 },
      expect.any(AbortSignal),
    )
    await act(async () => newPage.resolve(statement(1, 1, 'Other account')))
    await act(async () => oldPage.resolve(statement(3)))
    expect(screen.getByText('Other account page 1')).toBeInTheDocument()
    expect(screen.queryByText('Reader page 3')).not.toBeInTheDocument()
  })

  test('discards private rows and pending requests when signing out', async () => {
    const next = deferred()
    const user = userEvent.setup()
    const { rerender } = render(<AccountWallet />)
    await screen.findByText('Reader page 1')
    getWalletTransactions.mockReturnValueOnce(next.promise)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const signal = getWalletTransactions.mock.calls.at(-1)[1]
    rerender(<AccountWallet owner={null} />)
    expect(screen.queryByText('Reader page 1')).not.toBeInTheDocument()
    expect(signal.aborted).toBe(true)
    await act(async () => next.resolve(statement(2)))
    expect(screen.queryByRole('region', { name: 'Wallet transactions' })).not.toBeInTheDocument()
  })

  test.each([0, 5])(
    'returns to an available page when the statement shrinks to %s records',
    async (total) => {
      const user = userEvent.setup()
      const { rerender } = render(<AccountWallet />)
      await screen.findByText('Reader page 1')
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Reader page 2')
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Reader page 3')
      getWalletTransactions.mockImplementation(async ({ page }) =>
        statement(page, total, 'Updated'),
      )
      rerender(<AccountWallet revision={2} />)
      await waitFor(() =>
        expect(getWalletTransactions).toHaveBeenLastCalledWith(
          { page: 1, per_page: 10 },
          expect.any(AbortSignal),
        ),
      )
      if (total) expect(await screen.findByText('Updated page 1')).toBeInTheDocument()
      else expect(await screen.findByText('No transactions yet.')).toBeInTheDocument()
      expect(screen.queryByText('Reader page 3')).not.toBeInTheDocument()
    },
  )
})
