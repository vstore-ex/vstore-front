import { useEffect, useRef } from 'react'
import { useAuth } from '../../auth/context'
import { consumeOAuthDestination, oauthCallbackFailed } from '../../auth/oauth'
export default function OAuthCallbackPage() {
  const { status } = useAuth()
  const redirected = useRef(false)
  useEffect(() => {
    if (status === 'authenticated' && !oauthCallbackFailed && !redirected.current) {
      redirected.current = true
      window.location.replace('/' + consumeOAuthDestination())
    }
  }, [status])
  const pending = !oauthCallbackFailed && (status === 'loading' || status === 'authenticated')
  return (
    <main className="store-page">
      <section className="store-status" aria-live="polite">
        <h1>
          {pending
            ? 'Completing Google sign-in...'
            : status === 'banned'
              ? 'Account blocked'
              : 'Google sign-in could not be completed'}
        </h1>
        {pending ? (
          <p role="status">Restoring your session...</p>
        ) : (
          <>
            <p role="alert">
              {status === 'banned'
                ? 'Your account is blocked. Contact support for assistance.'
                : oauthCallbackFailed
                  ? 'Google sign-in was cancelled or rejected. Please try again.'
                  : 'We could not restore your session. Please try again or sign in with your account name.'}
            </p>
            {!oauthCallbackFailed && status !== 'banned' && (
              <button className="button button--secondary" onClick={() => window.location.reload()}>
                Retry session
              </button>
            )}
            <a className="button button--accent" href="/#/login">
              Back to sign in
            </a>
          </>
        )}
      </section>
    </main>
  )
}
