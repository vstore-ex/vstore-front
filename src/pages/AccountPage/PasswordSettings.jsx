import { useState } from 'react'
import { changePassword } from '../../api/auth'
import { passwordValidationError } from '../../utils/passwordValidation'

const initialValues = { current: '', next: '', confirm: '' }

function requestError(error) {
  if (error.status === 429) {
    return error.retryAfter
      ? `Too many requests. Please try again in ${error.retryAfter} seconds.`
      : 'Too many requests. Please try again later.'
  }
  if (error.status === 503) {
    return 'Password update is temporarily unavailable. Please try again later.'
  }
  return error.message || 'Could not update your password. Please try again.'
}

export default function PasswordSettings({ onPasswordChanged }) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setError('')
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    if (isSubmitting) return

    const nextErrors = {}
    if (!values.current) nextErrors.current = 'Enter your current password.'
    const passwordError = passwordValidationError(values.next)
    if (passwordError) nextErrors.next = passwordError
    if (values.next && values.next === values.current) {
      nextErrors.next = 'Choose a password different from your current password.'
    }
    if (values.confirm !== values.next) nextErrors.confirm = 'Passwords do not match.'
    setErrors(nextErrors)
    setError('')
    setMessage('')
    if (Object.keys(nextErrors).length) return

    setIsSubmitting(true)
    try {
      const response = await changePassword({
        current_password: values.current,
        new_password: values.next,
      })
      setValues(initialValues)
      setMessage(response?.message || 'Password changed. Sign in again on your devices.')
      await onPasswordChanged?.()
    } catch (error) {
      if (error.status === 400 && /current password/i.test(error.message)) {
        setErrors({ current: error.message })
      } else if (error.status === 422 && /password/i.test(error.message)) {
        setErrors({ next: error.message })
      } else {
        setError(requestError(error))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      className="account-section password-settings"
      aria-labelledby="password-settings-title"
    >
      <h2 id="password-settings-title">Password settings</h2>
      <p>
        Changing your password signs you out on all devices. If you sign in with Google and have not
        set a password, use “Forgot your password?” on the sign-in screen first.
      </p>
      <form className="store-form" onSubmit={submit} noValidate>
        <div className="password-settings__field">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            name="current"
            type="password"
            autoComplete="current-password"
            value={values.current}
            onChange={updateField}
            aria-invalid={Boolean(errors.current)}
            aria-describedby={errors.current ? 'current-password-error' : undefined}
            disabled={isSubmitting}
          />
          {errors.current && (
            <span id="current-password-error" className="store-form__error">
              {errors.current}
            </span>
          )}
        </div>
        <div className="password-settings__field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            name="next"
            type="password"
            autoComplete="new-password"
            value={values.next}
            onChange={updateField}
            aria-invalid={Boolean(errors.next)}
            aria-describedby={[errors.next && 'new-password-error', 'password-settings-hint']
              .filter(Boolean)
              .join(' ')}
            minLength={12}
            maxLength={72}
            disabled={isSubmitting}
          />
          {errors.next && (
            <span id="new-password-error" className="store-form__error">
              {errors.next}
            </span>
          )}
          <span id="password-settings-hint" className="password-settings__hint">
            At least 12 characters and no more than 72 UTF-8 bytes.
          </span>
        </div>
        <div className="password-settings__field">
          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input
            id="confirm-new-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={values.confirm}
            onChange={updateField}
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
            disabled={isSubmitting}
          />
          {errors.confirm && (
            <span id="confirm-password-error" className="store-form__error">
              {errors.confirm}
            </span>
          )}
        </div>
        {message && (
          <p role="status" className="store-form__status">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="store-form__error">
            {error}
          </p>
        )}
        <button className="button button--accent" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
