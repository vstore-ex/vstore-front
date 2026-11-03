import { useEffect, useRef, useState } from 'react'
import {
  registerUser,
  registrationErrors,
  getGoogleAuthorizationUrl,
  isUnverifiedLogin,
} from '../../api/auth'
import EmailVerification from '../../auth/EmailVerification'
import { rememberOAuthDestination } from '../../auth/oauth'
import { useAuth } from '../../auth/context'
import { validateLogin } from '../../utils/validation'
import { passwordValidationError } from '../../utils/passwordValidation'
import Dialog from '../../components/Dialog/Dialog'
import chevronLeft from '../../assets/icon-chevron-left.svg'
import authPanel from '../../assets/auth-panel.png'
import authQr from '../../assets/auth-qr.png'
import hcaptchaIcon from '../../assets/hcaptcha-icon.svg'
import './RegisterPage.css'

const initialLoginForm = {
  username: '',
  password: '',
}

const initialRegisterForm = {
  username: '',
  email: '',
  password: '',
  acceptedTerms: true,
  human: false,
}

function validateCreateAccount(form) {
  const nextErrors = {}
  if (!form.username.trim()) nextErrors.username = 'Enter an account name.'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    nextErrors.email = 'Enter a valid email.'
  }

  const passwordError = passwordValidationError(form.password)
  if (passwordError) nextErrors.password = passwordError

  if (!form.acceptedTerms) {
    nextErrors.acceptedTerms = 'You must accept the terms.'
  }

  if (!form.human) {
    nextErrors.human = 'Please confirm that you are human.'
  }

  return nextErrors
}

function RegisterPage({
  initialMode = 'login',
  initialNotice = '',
  onClose,
  onAuthenticated,
  onForgotPassword,
}) {
  const { login } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [loginForm, setLoginForm] = useState(initialLoginForm)
  const [registerForm, setRegisterForm] = useState(initialRegisterForm)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(() =>
    initialNotice ? { type: 'success', message: initialNotice } : { type: '', message: '' },
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleConnecting, setGoogleConnecting] = useState(false)
  const [verification, setVerification] = useState(null)
  const firstField = useRef(null)
  const createdTitle = useRef(null)
  const form = useRef(null)
  const focusErrors = useRef(false)

  const isRegister = mode === 'register'
  const isCreated = mode === 'created' || mode === 'resend'
  const activeForm = isRegister ? registerForm : loginForm

  useEffect(() => {
    const restored = () => {
      setIsSubmitting(false)
      setGoogleConnecting(false)
    }
    window.addEventListener('pageshow', restored)

    return () => {
      window.removeEventListener('pageshow', restored)
    }
  }, [])

  useEffect(() => {
    if (mode === 'created' || mode === 'resend') createdTitle.current?.focus()
    else firstField.current?.focus()
  }, [mode])

  useEffect(() => {
    if (!isSubmitting && focusErrors.current) {
      focusErrors.current = false
      form.current?.querySelector('[aria-invalid="true"]')?.focus()
    }
  }, [errors, isSubmitting])

  function switchMode(nextMode) {
    setMode(nextMode)
    setErrors({})
    setStatus({ type: '', message: '' })
  }

  function updateField(event) {
    const { checked, name, type, value } = event.target
    const setter = isRegister ? setRegisterForm : setLoginForm

    setter((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setStatus({ type: '', message: '' })
  }

  async function handleGoogleSignIn() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setGoogleConnecting(true)
    setStatus({ type: '', message: '' })
    try {
      const url = await getGoogleAuthorizationUrl()
      rememberOAuthDestination()
      window.location.assign(url)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not start Google sign-in.' })
      setIsSubmitting(false)
      setGoogleConnecting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return

    const nextErrors = isRegister ? validateCreateAccount(registerForm) : validateLogin(loginForm)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      focusErrors.current = true
      setStatus({ type: 'error', message: 'Please fix the highlighted fields.' })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      const result = isRegister
        ? await registerUser({
            username: registerForm.username.trim(),
            email: registerForm.email.trim(),
            password: registerForm.password,
            full_name: registerForm.username.trim(),
            phone: '',
          })
        : await login({
            username: loginForm.username.trim(),
            password: loginForm.password,
          })

      setStatus({ type: 'success', message: result.message })
      if (isRegister) {
        setVerification({
          email: result.data?.email || registerForm.email.trim(),
          delivery: result.data?.email_sent,
        })
        setLoginForm({ username: registerForm.username.trim(), password: '' })
        setRegisterForm(initialRegisterForm)
        setMode('created')
      } else {
        setLoginForm(initialLoginForm)
        await onAuthenticated?.(result.data)
        onClose()
      }
    } catch (error) {
      if (!isRegister && isUnverifiedLogin(error)) {
        setVerification(null)
        setMode('resend')
      }
      if (isRegister) {
        focusErrors.current = true
        setErrors(registrationErrors(error))
      }
      setStatus({
        type: 'error',
        message: error.message || 'Could not connect to auth server.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      className="auth-page auth-overlay"
      labelledBy="auth-title"
      busy={isSubmitting}
      initialFocusRef={firstField}
      closeLabel="Go back"
      closeContent={<img src={chevronLeft} alt="" />}
      onClose={onClose}
    >
      <div className="auth-shell">
        {!isCreated && (
          <h1 id="auth-title" className="auth-title">
            {isRegister ? 'Create an account' : 'Log in'}
          </h1>
        )}

        {isCreated ? (
          <div className="auth-card auth-card--created">
            <img className="auth-card__texture" src={authPanel} alt="" aria-hidden="true" />
            <h2 id="auth-title" ref={createdTitle} tabIndex={-1}>
              Confirm your email
            </h2>
            <p>
              Open the confirmation link in your email before signing in. Check your spam folder, or
              request another email.
            </p>
            <EmailVerification
              key={mode}
              email={verification?.email}
              delivery={verification?.delivery}
            />
            <button className="auth-submit" type="button" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </div>
        ) : (
          <form
            ref={form}
            className={`auth-card ${isRegister ? 'auth-card--create' : 'auth-card--figma'}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <img className="auth-card__texture" src={authPanel} alt="" aria-hidden="true" />

            <div className="auth-form-column">
              <button
                className="auth-google"
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
              >
                {isGoogleConnecting ? 'Connecting to Google...' : 'Continue with Google'}
              </button>
              <p className="auth-method-divider">or use your account name</p>
              {isRegister && (
                <div className="auth-field">
                  <label htmlFor="email">PUT YOUR EMAIL HERE</label>
                  <input
                    ref={firstField}
                    id="email"
                    name="email"
                    type="email"
                    value={registerForm.email}
                    onChange={updateField}
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'auth-email-error' : undefined}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <span id="auth-email-error" className="field-error">
                      {errors.email}
                    </span>
                  )}
                </div>
              )}

              {
                <div className="auth-field">
                  <label htmlFor="username">
                    {isRegister ? 'CREATE AN ACCOUNT NAME' : 'SIGN IN WITH ACCOUNT NAME'}
                  </label>
                  <input
                    ref={isRegister ? undefined : firstField}
                    id="username"
                    name="username"
                    value={activeForm.username}
                    onChange={updateField}
                    autoComplete="username"
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'auth-username-error' : undefined}
                    disabled={isSubmitting}
                  />
                  {errors.username && (
                    <span id="auth-username-error" className="field-error">
                      {errors.username}
                    </span>
                  )}
                </div>
              }

              <div className="auth-field">
                <label htmlFor="password">{isRegister ? 'CREATE A PASSWORD' : 'PASSWORD'}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={activeForm.password}
                  onChange={updateField}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    [errors.password && 'auth-password-error', isRegister && 'auth-password-hint']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  minLength={isRegister ? 12 : undefined}
                  maxLength={isRegister ? 72 : undefined}
                  disabled={isSubmitting}
                />
                {errors.password && (
                  <span id="auth-password-error" className="field-error">
                    {errors.password}
                  </span>
                )}
                {isRegister && (
                  <span id="auth-password-hint" className="auth-password-hint">
                    Use at least 12 characters. Passwords are limited to 72 UTF-8 bytes.
                  </span>
                )}
              </div>

              {!isRegister && onForgotPassword && (
                <button
                  className="auth-forgot-password"
                  type="button"
                  disabled={isSubmitting}
                  onClick={onForgotPassword}
                >
                  Forgot your password?
                </button>
              )}

              {isRegister && (
                <>
                  <label className="auth-terms">
                    <input
                      name="acceptedTerms"
                      type="checkbox"
                      checked={registerForm.acceptedTerms}
                      onChange={updateField}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(errors.acceptedTerms)}
                      aria-describedby={errors.acceptedTerms ? 'auth-terms-error' : undefined}
                    />
                    <span>
                      I am 13 years of age or older and agree to the terms of the Steam Subscriber
                      Agreement and the Valve Privacy Policy.
                    </span>
                  </label>
                  {errors.acceptedTerms && (
                    <span id="auth-terms-error" className="field-error auth-check-error">
                      {errors.acceptedTerms}
                    </span>
                  )}

                  <label className="auth-captcha">
                    <span className="auth-captcha__left">
                      <input
                        name="human"
                        type="checkbox"
                        checked={registerForm.human}
                        onChange={updateField}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(errors.human)}
                        aria-describedby={errors.human ? 'auth-human-error' : undefined}
                      />
                      <span>I am human</span>
                    </span>
                    <span className="auth-captcha__brand">
                      <img src={hcaptchaIcon} alt="" />
                      <span>hCaptcha</span>
                      <small>Privacy-Terms</small>
                    </span>
                  </label>
                  {errors.human && (
                    <span id="auth-human-error" className="field-error auth-check-error">
                      {errors.human}
                    </span>
                  )}
                </>
              )}

              {!isRegister && (
                <>
                  <div className="auth-actions">
                    <button className="auth-submit" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'PLEASE WAIT...' : 'SIGN IN'}
                    </button>
                    <button
                      className="auth-help"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setVerification(null)
                        switchMode('resend')
                      }}
                    >
                      Resend confirmation email
                    </button>
                  </div>

                  <div className="auth-switch">
                    <p>no account?</p>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => switchMode('register')}
                    >
                      Create a new one!
                    </button>
                  </div>
                </>
              )}

              {isRegister && (
                <button
                  className="auth-submit auth-submit--create"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'PLEASE WAIT...' : 'SIGN IN'}
                </button>
              )}

              {status.message && (
                <p
                  className={`form-status form-status--${status.type}`}
                  role={status.type === 'error' ? 'alert' : 'status'}
                >
                  {status.message}
                </p>
              )}
            </div>

            {!isRegister && (
              <aside className="qr-panel" aria-label="QR code sign in">
                <p className="qr-panel__title">SIGN IN WITH QRCODE</p>
                <img className="qr-panel__image" src={authQr} alt="QR code for sign in" />
                <p className="qr-panel__copy">
                  Use out app or other means to scan this QRcode and log in into your account
                </p>
              </aside>
            )}
          </form>
        )}
      </div>
    </Dialog>
  )
}

export default RegisterPage
