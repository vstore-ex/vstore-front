
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
let refreshPromise
let generation = 0
let refreshed = 0
let ended = false
export function resetSession(active = true) { generation += 1; ended = !active }
export class ApiError extends Error {
  constructor(message, status, detail, problem = null) {
    super(message); this.status = status; this.detail = detail
    this.problem = problem
    this.errors = Array.isArray(problem?.errors) ? problem.errors : []
    this.requestId = problem?.request_id || null
    this.banned = status === 403 && /account banned/i.test(message)
  }
}
function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })) }
function rejectSession(error, version) {
  if (version !== generation || ended) return
  ended = true
  generation += 1
  emit(error.banned ? 'vstore:account-banned' : 'vstore:session-expired', error.message)
}
export async function refreshSession() {
  if (!refreshPromise) {
    const version = generation
    emit('vstore:refresh', true)
    refreshPromise = apiRequest('/auth/refresh', { method: 'POST', auth: false }).then((data) => {
      if (data?.access_token) {
        try { localStorage.setItem('vstore:token', data.access_token) } catch { /* storage disabled */ }
      }
      if (version === generation) refreshed += 1
    }).catch(error => {
      try { localStorage.removeItem('vstore:token') } catch { /* storage disabled */ }
      rejectSession(error, version)
      throw error
    }).finally(() => { refreshPromise = null; emit('vstore:refresh', false) })
  }
  return refreshPromise
}
export async function waitForRefresh() { await refreshPromise?.catch(() => {}) }

export async function apiRequest(path, { body, headers, signal, timeout = 20000, auth = true, ...options } = {}) {
  const version = generation
  const refreshVersion = refreshed
  const multipart = body instanceof FormData
  const encoded = body instanceof URLSearchParams
  const request = () => {
    let token = null
    try { token = localStorage.getItem('vstore:token') } catch { /* storage disabled */ }
    const authHeaders = auth && token ? { Authorization: `Bearer ${token}` } : {}
    return fetch(API_BASE_URL + path, {
      ...options, credentials: 'include', cache: 'no-store',
      headers: { ...(body && !multipart && !encoded ? { 'Content-Type': 'application/json' } : {}), ...authHeaders, ...headers },
      body: body == null ? undefined : multipart || encoded || typeof body === 'string' ? body : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
    })
  }
  let response = await request()
  if (response.status === 401 && auth && !ended && version === generation) {
    if (refreshVersion === refreshed) await refreshSession()
    signal?.throwIfAborted()
    if (version !== generation) throw new ApiError('Your session has ended. Please sign in again.', 401)
    response = await request()
  }
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }
  if (!response.ok) {
    const detail = data?.detail || data?.message
    let message
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      message = data.errors.map(item => item.message || item.msg).filter(Boolean).join('. ')
    } else if (Array.isArray(detail)) {
      message = detail.map(item => item.msg || item.message).filter(Boolean).join(' ')
    } else if (typeof detail === 'string') {
      message = detail
    } else if (response.status === 413) {
      message = 'The uploaded file is too large. Please choose a smaller image.'
    } else {
      message = `Request failed (${response.status}). Please try again.`
    }
    const error = new ApiError(message, response.status, detail, data)
    error.requestId = data?.request_id || response.headers.get('X-Request-ID') || null
    const retryAfter = response.headers.get('Retry-After')
    error.retryAfter = retryAfter ? parseInt(retryAfter, 10) : null
    if (error.banned || (auth && response.status === 401)) rejectSession(error, version)
    throw error
  }
  return data
}

export function mediaUrl(value, origin) {
  if (!value || typeof value !== 'string') return ''
  try {
    const base = new URL(API_BASE_URL, window.location.origin)
    const url = new URL(value, origin || base.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
