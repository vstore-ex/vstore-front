import { useEffect, useState } from 'react'
import Dialog from '../components/Dialog/Dialog'
import { useAuth } from '../auth/context'
import { useWallet } from '../wallet/context'
import { getCurrencies } from '../api/currency'
import { walletError } from '../api/wallet'
import { formatMoney, isCurrencyCode } from '../utils/money'
import { CurrencyContext } from './context'
import './Currency.css'

const storageKey = 'vstore:currency'
function readGuestCurrency() {
  try {
    const value = localStorage.getItem(storageKey)
    return isCurrencyCode(value) ? value : 'USD'
  } catch {
    return 'USD'
  }
}

function Confirmation({ target, wallet, onClose }) {
  const [error, setError] = useState('')
  const frozen = wallet.data?.is_frozen
  const message = frozen
    ? 'Your wallet is frozen. Currency changes are unavailable. Contact support.'
    : error || wallet.error
  async function confirm(event) {
    event.preventDefault()
    if (wallet.busy || wallet.loading || !wallet.data || wallet.error || frozen) return
    setError('')
    try {
      if (await wallet.changeCurrency(target.code)) onClose()
    } catch (reason) {
      setError(walletError(reason))
    }
  }
  return (
    <Dialog
      className="currency-confirm"
      labelledBy="currency-confirm-title"
      busy={wallet.busy}
      onClose={onClose}
    >
      <form onSubmit={confirm}>
        <h2 id="currency-confirm-title">Change wallet currency?</h2>
        <p>
          Switch to {target.code} — {target.name}.
        </p>
        {wallet.data && (
          <p>Current balance: {formatMoney(wallet.data.balance, wallet.data.currency)}.</p>
        )}
        <p>
          Your balance will be converted at the current server exchange rate. Store, cart and
          wishlist prices will update after confirmation.
        </p>
        <p>Previous orders and transactions keep their original purchase currencies.</p>
        {message && <p role="alert">{message}</p>}
        {wallet.error && (
          <button type="button" disabled={wallet.loading || wallet.busy} onClick={wallet.refresh}>
            Refresh wallet
          </button>
        )}
        <div className="currency-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={wallet.busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button--accent"
            disabled={wallet.busy || wallet.loading || !!wallet.error || !wallet.data || frozen}
          >
            {wallet.busy ? 'Converting...' : 'Confirm currency change'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function CurrencyProvider({ children }) {
  const { currentUser, status } = useAuth()
  const owner = currentUser?.id ?? null
  const wallet = useWallet()
  const [guestCode, setGuestCode] = useState(readGuestCurrency)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  const [selection, setSelection] = useState({ owner, pending: null })
  const selectionCurrent =
    selection.owner === owner &&
    (!selection.pending || selection.currency === wallet.data?.currency)
  // Discard stale consent before rendering children; it must not survive a new
  // account or a currency change confirmed by another session.
  if (!selectionCurrent) setSelection({ owner, pending: null })
  const pending = selectionCurrent ? selection.pending : null
  useEffect(() => {
    const controller = new AbortController()
    getCurrencies(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ attempt, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ attempt, error })
      })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const sync = (event) => {
      if (event.key === storageKey || event.key === null) setGuestCode(readGuestCurrency())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const currencies = result?.data || []
  const guestSupported = currencies.some((item) => item.code === guestCode)
  const listError = result?.attempt === attempt ? result.error?.message || '' : ''
  const retryCurrencies = () => setAttempt((value) => value + 1)
  const code =
    status === 'loading'
      ? null
      : currentUser
        ? wallet.data?.currency || null
        : guestSupported
          ? guestCode
          : currencies.find((item) => item.code === 'USD')?.code || currencies[0]?.code || null
  // A saved preference is not evidence that a currency is still active. Wait
  // for the server list, then persist the validated choice (including fallback).
  useEffect(() => {
    if (currentUser || !code) return
    try {
      if (localStorage.getItem(storageKey) !== code) localStorage.setItem(storageKey, code)
    } catch {
      /* Selection still works when storage is unavailable. */
    }
  }, [currentUser, code, guestCode])
  function choose(code) {
    const target = currencies.find((item) => item.code === code)
    if (!target || wallet.busy || (currentUser && (wallet.loading || !wallet.data || wallet.error)))
      return
    if (currentUser) {
      if (code !== wallet.data.currency)
        setSelection({ owner, currency: wallet.data.currency, pending: target })
    } else {
      setGuestCode(code)
    }
  }
  return (
    <CurrencyContext.Provider
      value={{
        code,
        currencies,
        choose,
        switching: wallet.operation === 'currency',
        unavailable: currentUser ? (!wallet.data ? wallet.error : '') : listError,
        walletError: currentUser ? wallet.error : '',
        refreshWallet: wallet.refresh,
        retryPrices: currentUser ? wallet.refresh : retryCurrencies,
        disabled:
          status === 'loading' ||
          wallet.busy ||
          (currentUser ? wallet.loading || !wallet.data || !!wallet.error : !currencies.length),
        loading: result?.attempt !== attempt,
        error: listError,
        retry: retryCurrencies,
      }}
    >
      {children}
      {pending && (
        <Confirmation
          key={pending.code}
          target={pending}
          wallet={wallet}
          onClose={() =>
            setSelection((previous) =>
              previous === selection ? { owner, pending: null } : previous,
            )
          }
        />
      )}
    </CurrencyContext.Provider>
  )
}
