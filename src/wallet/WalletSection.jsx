import { useEffect, useRef, useState } from 'react'
import { getWalletTransactions, moneyCents, walletError } from '../api/wallet'
import { formatMoney } from '../api/cart'
import { useWallet } from './context'
import TopUpDialog from './TopUpDialog'
import { useAuth } from '../auth/context'
import './Wallet.css'

const transactionLabels = {
  top_up: 'Top-up',
  deposit: 'Top-up',
  purchase: 'Game purchase',
  refund: 'Refund',
  currency_conversion: 'Currency conversion',
  admin_adjustment: 'Balance adjustment',
  adjustment: 'Balance adjustment',
  freeze_toggle: 'Wallet status change',
}

function Transactions({ revision }) {
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const current =
    result?.page === page && result?.attempt === attempt && result?.revision === revision
  useEffect(() => {
    const controller = new AbortController()
    getWalletTransactions({ page, per_page: 10 }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, data.total_pages)
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult({ page, attempt, revision, data })
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            page,
            attempt,
            revision,
            data: previous?.data,
            error: walletError(reason),
          }))
      })
    return () => controller.abort()
  }, [page, attempt, revision])
  const data = result?.data
  return (
    <div className="wallet-history" aria-busy={!current}>
      <h3>Transaction history</h3>
      {!current && <p role="status">Loading transactions...</p>}
      {current && result.error && (
        <div role="alert">
          <p>{result.error}</p>
          <button
            className="button button--secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry history
          </button>
        </div>
      )}
      {current && !result.error && data?.items.length === 0 && <p>No transactions yet.</p>}
      {!!data?.items.length && (
        <div
          className="wallet-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Wallet transactions"
        >
          <table>
            <caption className="wallet-sr-only">
              Wallet transaction history, page {data.page}
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Amount</th>
                <th scope="col">Balance after</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="wallet-cell-label" aria-hidden="true">
                      Date
                    </span>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString()}
                    </time>
                  </td>
                  <td>
                    <span className="wallet-cell-label" aria-hidden="true">
                      Type
                    </span>
                    <span>
                      {transactionLabels[item.transaction_type] || 'Other transaction'}
                      {item.description && <small>{item.description}</small>}
                    </span>
                  </td>
                  <td className={moneyCents(item.amount) > 0 ? 'wallet-credit' : 'wallet-debit'}>
                    <span className="wallet-cell-label" aria-hidden="true">
                      Amount
                    </span>
                    <span>
                      {moneyCents(item.amount) > 0 ? '+' : ''}
                      {formatMoney(item.amount, item.currency)}
                    </span>
                  </td>
                  <td>
                    <span className="wallet-cell-label" aria-hidden="true">
                      Balance after
                    </span>
                    <span>{formatMoney(item.balance_after, item.currency)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total_pages > 1 && (
        <nav className="wallet-pagination" aria-label="Transaction pages">
          <button
            className="button button--secondary"
            disabled={!current || !!result.error || data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {data.page} of {data.total_pages}
          </span>
          <button
            className="button button--secondary"
            disabled={!current || !!result.error || data.page >= data.total_pages}
            onClick={() => setPage(data.page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}

function AccountWalletSection({ focusWallet = false }) {
  const wallet = useWallet()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const section = useRef(null)
  useEffect(() => {
    if (!focusWallet) return
    const frame = requestAnimationFrame(() => {
      section.current?.scrollIntoView({ block: 'start' })
      section.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusWallet])
  return (
    <section
      className="account-section wallet-section"
      id="wallet"
      ref={section}
      tabIndex={-1}
      aria-labelledby="wallet-title"
    >
      <div className="wallet-summary">
        <div>
          <h2 id="wallet-title">My wallet</h2>
          {wallet.loading && <p role="status">Updating balance...</p>}
          {wallet.data && (
            <p className="wallet-balance">
              {formatMoney(wallet.data.balance, wallet.data.currency)}{' '}
              <small>{wallet.data.currency}</small>
            </p>
          )}
          {wallet.data?.is_frozen && (
            <p className="wallet-frozen" role="status">
              Frozen wallet — payments and top-ups are unavailable. Contact support.
            </p>
          )}
        </div>
        <button
          className="button button--accent"
          disabled={
            wallet.loading || wallet.busy || !!wallet.error || !wallet.data || wallet.data.is_frozen
          }
          onClick={() => setTopUpOpen(true)}
        >
          Top up wallet
        </button>
      </div>
      {wallet.error && <p role="alert">{wallet.error}</p>}
      <button
        className="button button--secondary"
        disabled={wallet.loading || wallet.busy}
        onClick={wallet.refresh}
      >
        Refresh balance
      </button>
      <Transactions revision={wallet.revision} />
      {topUpOpen && <TopUpDialog onClose={() => setTopUpOpen(false)} />}
    </section>
  )
}

export default function WalletSection(props) {
  const { currentUser } = useAuth()
  // Reset statement pages, retained rows and dialogs when the wallet owner changes.
  return currentUser ? <AccountWalletSection key={currentUser.id} {...props} /> : null
}
