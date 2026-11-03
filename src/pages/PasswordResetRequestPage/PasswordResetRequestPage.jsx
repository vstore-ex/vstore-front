import { useEffect, useRef, useState } from 'react'
import { requestPasswordReset } from '../../api/auth'
import './PasswordResetRequestPage.css'

function getRequestError(error) {
  if (error.status === 429) {
    return error.retryAfter
      ? `Too many requests. Please try again in ${error.retryAfter} seconds.`
      : 'Too many requests. Please try again later.'
  }
  if (error.status === 503) {
    return 'Password reset is temporarily unavailable. Please try again later.'
  }
  return error.message || 'Could not request a password reset. Please try again.'
}

export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeRequest = useRef(null)

  useEffect(() => () => activeRequest.current?.abort(), [])

  async function submit(event) {
    event.preventDefault()
    if (isSubmitting) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      setMessage('')
      return
    }

    const controller = new AbortController()
    activeRequest.current = controller
    setIsSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await requestPasswordReset(email, controller.signal)
      if (!controller.signal.aborted) setMessage(response)
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getRequestError(requestError))
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        if (!controller.signal.aborted) setIsSubmitting(false)
      }
    }
  }

  return (
    <section className="password-reset-request" aria-labelledby="password-reset-title">
      <h1 id="password-reset-title">Reset your password</h1>
      <p>
        Enter the email address associated with your account. We will send a reset link if an
        account matches.
      </p>
      <form className="store-form" onSubmit={submit} noValidate>
        <label htmlFor="password-reset-email">
          Email address
          <input
            id="password-reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError('')
              setMessage('')
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'password-reset-error' : undefined}
            disabled={isSubmitting}
            required
          />
        </label>
        {error && (
          <p id="password-reset-error" className="store-form__error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="store-form__status" role="status">
            {message}
          </p>
        )}
        <button className="button button--accent" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <a href="#/login">Back to sign in</a>
    </section>
  )
}
