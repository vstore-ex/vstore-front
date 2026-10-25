import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import { CurrencyContext } from '../src/currency/context'
import WalletProvider from '../src/wallet/WalletProvider'
import WalletSection from '../src/wallet/WalletSection'
import Header from '../src/components/Header/Header'
import * as api from '../src/api/wallet'
import { deferred } from './helpers'

vi.mock('../src/api/wallet', async (original) => ({
  ...(await original()),
  getWallet: vi.fn(),
  topUpWallet: vi.fn(),
  getWalletTransactions: vi.fn(),
}))
const wallet = { balance: '100.00', currency: 'USD', is_frozen: false }
const currency = { code: 'USD', currencies: [{ code: 'USD', name: 'US Dollar' }] }
beforeEach(() => {
  api.getWallet.mockReset().mockResolvedValue(wallet)
  api.topUpWallet.mockReset().mockResolvedValue({ ...wallet, balance: '125.00' })
  api.getWalletTransactions
    .mockReset()
    .mockResolvedValue({ items: [], total: 0, page: 1, per_page: 10, total_pages: 0 })
})
function Account({ owner = 7 }) {
  return (
    <AuthContext.Provider value={{ currentUser: owner == null ? null : { id: owner } }}>
      <WalletProvider>
        <CurrencyContext.Provider value={currency}>
          <Header isAuthenticated={owner != null} />
          <WalletSection />
        </CurrencyContext.Provider>
      </WalletProvider>
    </AuthContext.Provider>
  )
}
async function openTopUp() {
  const user = userEvent.setup()
  const rendered = render(<Account />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Top up wallet' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Top up wallet' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Top up wallet' }))
  return {
    ...rendered,
    user,
    dialog,
    submit: dialog.getByRole('button', { name: 'Top up', exact: true }),
  }
}

test('shows a lost-response error while balance reconciliation is pending, without retrying the deposit', async () => {
  const { user, dialog, submit } = await openTopUp()
  const deposit = deferred()
  const reconciliation = deferred()
  api.topUpWallet.mockReturnValueOnce(deposit.promise)
  api.getWallet.mockReturnValueOnce(reconciliation.promise)
  await user.click(submit)
  expect(dialog.getByRole('button', { name: 'Processing...' })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  await user.click(dialog.getByRole('button', { name: 'Processing...' }))
  expect(api.topUpWallet).toHaveBeenCalledExactlyOnceWith('25.00')
  await act(async () => deposit.reject(new TypeError('Connection lost')))
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Check your balance and transaction history before trying again.',
  )
  expect(dialog.getByText('Updating balance...')).toBeInTheDocument()
  expect(dialog.getByRole('button', { name: 'Top up', exact: true })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('Updating...')
  await act(async () => reconciliation.resolve({ ...wallet, balance: '125.00' }))
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$125.00')
  expect(dialog.getByText('Current balance: $125.00')).toBeInTheDocument()
  expect(api.topUpWallet).toHaveBeenCalledTimes(1)
  expect(dialog.queryByText('Your wallet has been topped up.')).not.toBeInTheDocument()
})

test('a failed reconciliation offers a balance-only retry before another top-up is allowed', async () => {
  const { user, dialog, submit } = await openTopUp()
  const reconciliation = deferred()
  api.getWallet.mockReturnValueOnce(reconciliation.promise)
  api.topUpWallet.mockRejectedValueOnce({ status: 503, message: 'Payment unavailable' })
  await user.click(submit)
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Check your balance and transaction history',
  )
  await act(async () => reconciliation.reject({ status: 503, message: 'Wallet unavailable' }))
  expect(dialog.getByRole('button', { name: 'Top up', exact: true })).toBeDisabled()
  await user.click(dialog.getByRole('button', { name: 'Refresh balance' }))
  await waitFor(() =>
    expect(dialog.getByRole('button', { name: 'Top up', exact: true })).toBeEnabled(),
  )
  expect(api.topUpWallet).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$100.00')
})

test.each(['0', '-1', '10.001', '1e3'])(
  'invalid amount %j has an associated focused field error and never reaches the API',
  async (amount) => {
    const { user, dialog, submit } = await openTopUp()
    const input = dialog.getByRole('textbox', { name: 'Amount (USD)' })
    await user.clear(input)
    await user.type(input, amount)
    await user.click(submit)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/Enter an amount between 0.01 and 10,000/)
    expect(input).toHaveFocus()
    expect(api.topUpWallet).not.toHaveBeenCalled()
    await user.click(dialog.getByRole('button', { name: '$50.00' }))
    expect(input).toHaveValue('50')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(dialog.queryByRole('alert')).not.toBeInTheDocument()
  },
)

test('updates the header and account balance after a valid custom deposit, with no reload or duplicate submit', async () => {
  const { user, dialog, submit } = await openTopUp()
  const input = dialog.getByRole('textbox', { name: 'Amount (USD)' })
  await user.clear(input)
  await user.type(input, '12.34')
  api.topUpWallet.mockResolvedValueOnce({ ...wallet, balance: '112.34' })
  const initialHistoryCalls = api.getWalletTransactions.mock.calls.length
  await user.click(submit)
  expect(api.topUpWallet).toHaveBeenCalledExactlyOnceWith('12.34')
  expect(await dialog.findByText('Your wallet has been topped up.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$112.34')
  expect(dialog.queryByRole('button', { name: 'Top up', exact: true })).not.toBeInTheDocument()
  await waitFor(() =>
    expect(api.getWalletTransactions.mock.calls.length).toBeGreaterThan(initialHistoryCalls),
  )
  await user.click(dialog.getByRole('button', { name: 'Done' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top up wallet' })).toHaveFocus()
})

test('can close the failed-deposit dialog while the background balance check is pending', async () => {
  const { user, dialog, submit } = await openTopUp()
  const reconciliation = deferred()
  api.getWallet.mockReturnValueOnce(reconciliation.promise)
  api.topUpWallet.mockRejectedValueOnce(new Error('Connection lost'))
  await user.click(submit)
  await dialog.findByRole('alert')
  await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Top up wallet' })).toBeDisabled()
  await act(async () => reconciliation.resolve(wallet))
  expect(screen.getByRole('button', { name: 'Top up wallet' })).toBeEnabled()
})

test('handles a wallet frozen by another session while the dialog is open', async () => {
  const { dialog } = await openTopUp()
  api.getWallet.mockResolvedValueOnce({ ...wallet, is_frozen: true })
  act(() => window.dispatchEvent(new Event('focus')))
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Your wallet is frozen. Top-ups are unavailable.',
  )
  expect(dialog.getByRole('button', { name: 'Top up', exact: true })).toBeDisabled()
  expect(api.topUpWallet).not.toHaveBeenCalled()
})

test('shows server-disabled top-ups without presenting them as successful', async () => {
  const { user, dialog, submit } = await openTopUp()
  api.topUpWallet.mockRejectedValueOnce({ status: 400, message: 'top-up disabled' })
  await user.click(submit)
  expect(await dialog.findByRole('alert')).toHaveTextContent(
    'Direct top-ups are unavailable on this server.',
  )
  expect(dialog.queryByText('Your wallet has been topped up.')).not.toBeInTheDocument()
  expect(api.topUpWallet).toHaveBeenCalledTimes(1)
})

test('discards a late top-up response after switching accounts', async () => {
  const { user, rerender, submit } = await openTopUp()
  const deposit = deferred()
  api.topUpWallet.mockReturnValueOnce(deposit.promise)
  await user.click(submit)
  api.getWallet.mockResolvedValueOnce({ ...wallet, balance: '10.00' })
  rerender(<Account owner={8} />)
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$10.00'),
  )
  await act(async () => deposit.resolve({ ...wallet, balance: '125.00' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveTextContent('$10.00')
})

test('wallet controls remain hidden for guests', () => {
  render(<Account owner={null} />)
  expect(screen.queryByRole('button', { name: 'Top up wallet' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Open wallet' })).not.toBeInTheDocument()
  expect(api.getWallet).not.toHaveBeenCalled()
})
