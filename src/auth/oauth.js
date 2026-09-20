const RETURN_KEY = 'vstore:oauth:return'
export const isOAuthCallback = /^\/oauth\/callback\/?$/.test(window.location.pathname)
export const oauthCallbackFailed = isOAuthCallback && new URLSearchParams(window.location.search).has('error')
if (isOAuthCallback) {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (token) {
    try { localStorage.setItem('vstore:token', token) } catch { /* storage disabled */ }
  }
  window.history.replaceState(null, '', window.location.pathname)
}

function safeDestination(hash) {
  return typeof hash === 'string' && /^#\/(?:discover(?:\?[^#]*)?|account|orders|cart|wishlist|support|products\/\d+(?:\/achievements)?)$/.test(hash)
    ? hash : '#/discover'
}
export function rememberOAuthDestination() {
  const hash = window.location.hash
  const next = hash.startsWith('#/login') ? '#/' + (new URLSearchParams(hash.split('?')[1]).get('next') || 'discover') : hash
  // Only a navigation destination is stored, never credentials or auth state.
  try { sessionStorage.setItem(RETURN_KEY, safeDestination(next)) } catch { /* Storage can be disabled. */ }
}
export function consumeOAuthDestination() {
  try {
    const destination = safeDestination(sessionStorage.getItem(RETURN_KEY))
    sessionStorage.removeItem(RETURN_KEY)
    return destination
  } catch { return '#/discover' }
}
