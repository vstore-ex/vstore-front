import { useEffect, useId, useRef, useState } from 'react'
import { resendVerification } from '../api/auth'
import './EmailVerification.css'

export default function EmailVerification({ email = '', delivery, disabled = false }) {
  const [address, setAddress] = useState(email)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const pending = useRef(null)
  const input = useRef(null)
  const id = useId()
  useEffect(() => () => pending.current?.abort(), [])

  async function resend(event) {
    event.preventDefault()
    if (pending.current || disabled) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim())) {
      setStatus({ error: true, invalid: true, text: 'Enter a valid email address.' })
      input.current?.focus()
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setStatus(null)
    try {
      const text = await resendVerification(address, controller.signal)
      if (!controller.signal.aborted) setStatus({ text })
    } catch (error) {
      if (!controller.signal.aborted)
        setStatus({
          error: true,
          text:
            error.status === 429
              ? 'Too many requests. Please try again later.'
              : error.message || 'Could not request a confirmation email. Please try again.',
        })
    } finally {
      if (pending.current === controller) pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <form
      className="email-verification"
      aria-label="Email confirmation"
      onSubmit={resend}
      noValidate
    >
      {email ? (
        <p>
          Confirmation address: <strong>{email}</strong>
        </p>
      ) : (
        <label htmlFor={id}>
          Email address for confirmation
          <input
            ref={input}
            id={id}
            type="email"
            autoComplete="email"
            maxLength={100}
            value={address}
            disabled={busy || disabled}
            aria-invalid={Boolean(status?.invalid)}
            aria-describedby={status?.invalid ? id + '-status' : undefined}
            onChange={(event) => {
              setAddress(event.target.value)
              setStatus(null)
            }}
          />
        </label>
      )}
      {delivery === false && !status?.text && (
        <p className="email-verification__error" role="alert">
          The confirmation email could not be sent. Request another email below.
        </p>
      )}
      <button className="button button--secondary" type="submit" disabled={busy || disabled}>
        {busy ? 'Requesting email...' : 'Resend confirmation email'}
      </button>
      {status && (
        <p
          id={id + '-status'}
          role={status.error ? 'alert' : 'status'}
          className={status.error ? 'email-verification__error' : ''}
        >
          {status.text}
        </p>
      )}
    </form>
  )
}
