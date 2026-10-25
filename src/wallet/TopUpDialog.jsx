import { useRef, useState } from 'react'
import Dialog from '../components/Dialog/Dialog'
import { formatMoney } from '../api/cart'
import { topUpAmount, walletError } from '../api/wallet'
import { useWallet } from './context'
import './Wallet.css'

export default function TopUpDialog({ onClose }) {
  const wallet = useWallet()
  const [amount, setAmount] = useState('25')
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [success, setSuccess] = useState(false)
  const amountInput = useRef(null)
  const unavailable =
    wallet.loading || wallet.busy || !!wallet.error || !wallet.data || wallet.data.is_frozen
  function changeAmount(value) {
    setAmount(value)
    setValidationError('')
  }
  async function submit(event) {
    event.preventDefault()
    if (unavailable || success) return
    setError('')
    setValidationError('')
    let validated
    try {
      validated = topUpAmount(amount)
    } catch (reason) {
      setValidationError(reason.message)
      amountInput.current?.focus()
      return
    }
    try {
      const result = await wallet.topUp(validated)
      if (result) setSuccess(true)
    } catch (reason) {
      setError(
        walletError(reason) +
          (!reason.status || reason.status >= 500
            ? ' Check your balance and transaction history before trying again.'
            : ''),
      )
    }
  }
  return (
    <Dialog
      className="wallet-dialog"
      labelledBy="top-up-title"
      busy={wallet.busy}
      initialFocusRef={amountInput}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <h2 id="top-up-title">Top up wallet</h2>
        {wallet.loading && <p role="status">Updating balance...</p>}
        {wallet.data && (
          <p>Current balance: {formatMoney(wallet.data.balance, wallet.data.currency)}</p>
        )}
        {success ? (
          <p role="status">Your wallet has been topped up.</p>
        ) : (
          <>
            <div className="wallet-presets" aria-label="Suggested amounts">
              {[10, 25, 50, 100].map((value) => (
                <button
                  className="button button--secondary"
                  type="button"
                  key={value}
                  disabled={unavailable}
                  aria-pressed={Number(amount) === value}
                  onClick={() => changeAmount(String(value))}
                >
                  {formatMoney(value, wallet.data?.currency)}
                </button>
              ))}
            </div>
            <label className="wallet-amount">
              Amount ({wallet.data?.currency || '...'})
              <input
                ref={amountInput}
                inputMode="decimal"
                value={amount}
                maxLength={12}
                disabled={unavailable}
                onChange={(event) => changeAmount(event.target.value)}
                aria-invalid={!!validationError}
                aria-describedby={`top-up-hint${validationError ? ' top-up-error' : ''}`}
              />
            </label>
            <p id="top-up-hint">Enter 0.01 to 10,000, with up to two decimal places.</p>
            {validationError && (
              <p id="top-up-error" role="alert">
                {validationError}
              </p>
            )}
          </>
        )}
        {wallet.data?.is_frozen && (
          <p role="alert">Your wallet is frozen. Top-ups are unavailable.</p>
        )}
        {wallet.error && (
          <div role="alert">
            {wallet.error}{' '}
            <button type="button" disabled={wallet.loading || wallet.busy} onClick={wallet.refresh}>
              Refresh balance
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="wallet-actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={wallet.busy}
            onClick={onClose}
          >
            {success ? 'Done' : 'Cancel'}
          </button>
          {!success && (
            <button className="button button--accent" disabled={unavailable} type="submit">
              {wallet.busy ? 'Processing...' : 'Top up'}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  )
}
