import { beforeEach, describe, expect, test, vi } from 'vitest'
import { deferred, jsonResponse } from '../helpers'

let apiRequest, ApiError, resetSession, mediaUrl, fetchMock
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1')
  ;({ apiRequest, ApiError, resetSession, mediaUrl } = await import('../../src/api/client'))
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('API request contract', () => {
  test('forwards the bearer token, cookies, JSON body, custom headers and cancellation', async () => {
    localStorage.setItem('vstore:token', 'test-token')
    fetchMock.mockResolvedValue(jsonResponse({ id: 9 }))
    const controller = new AbortController()
    await expect(apiRequest('/orders', {
      method: 'POST', body: { terms_accepted: true }, headers: { 'X-Client': 'test' }, signal: controller.signal,
    })).resolves.toEqual({ id: 9 })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/orders')
    expect(options).toMatchObject({
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', 'X-Client': 'test' },
      body: '{"terms_accepted":true}',
    })
    controller.abort()
    expect(options.signal.aborted).toBe(true)
  })

  test('does not attach a token or refresh a public request', async () => {
    localStorage.setItem('vstore:token', 'private-token')
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Unauthorized' }, 401))
    await expect(apiRequest('/public', { auth: false })).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
  })

  test('preserves multipart boundaries and accepts an empty 204 response', async () => {
    const form = new FormData()
    form.append('avatar', new Blob(['image'], { type: 'image/png' }), 'avatar.png')
    fetchMock.mockResolvedValue(jsonResponse(null, 204))
    await expect(apiRequest('/avatar', { method: 'POST', body: form })).resolves.toBeNull()
    expect(fetchMock.mock.calls[0][1].body).toBe(form)
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type')
  })

  test('preserves network failures for caller recovery without retrying a write', async () => {
    const offline = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(offline)
    await expect(apiRequest('/orders', { method: 'POST', body: {} })).rejects.toBe(offline)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('normalizes validation errors and preserves diagnostic metadata', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      errors: [{ message: 'Name is required' }, { msg: 'Invalid email' }], request_id: 'request-42',
    }, 422))
    const error = await apiRequest('/users').catch(reason => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, message: 'Name is required. Invalid email', requestId: 'request-42' })
    expect(error.errors).toHaveLength(2)
  })

  test('provides a useful error for non-JSON server failures', async () => {
    fetchMock.mockResolvedValue(new Response('<html>unavailable</html>', {
      status: 503, headers: { 'X-Request-ID': 'proxy-1', 'Retry-After': '30' },
    }))
    await expect(apiRequest('/games')).rejects.toMatchObject({
      status: 503, message: 'Request failed (503). Please try again.', requestId: 'proxy-1', retryAfter: 30,
    })
  })

  test('refreshes once for concurrent 401s and retries with the new token', async () => {
    localStorage.setItem('vstore:token', 'expired')
    const refresh = deferred()
    fetchMock.mockImplementation((url, options) => {
      if (url.endsWith('/auth/refresh')) return refresh.promise
      return Promise.resolve(options.headers.Authorization === 'Bearer renewed'
        ? jsonResponse({ ok: true }) : jsonResponse({ detail: 'Expired' }, 401))
    })
    const requests = Promise.all([apiRequest('/me/cart'), apiRequest('/wishlists/')])
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1))
    refresh.resolve(jsonResponse({ access_token: 'renewed' }))
    await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(localStorage.getItem('vstore:token')).toBe('renewed')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  test('stops after refresh failure, clears credentials and emits session expiration', async () => {
    localStorage.setItem('vstore:token', 'expired')
    const expired = vi.fn()
    window.addEventListener('vstore:session-expired', expired)
    try {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'Expired session' }, 401))
      // Each request needs its own response body.
      fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ detail: 'Expired session' }, 401)))
      await expect(apiRequest('/me/cart')).rejects.toMatchObject({ status: 401 })
      expect(localStorage.getItem('vstore:token')).toBeNull()
      expect(expired).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally { window.removeEventListener('vstore:session-expired', expired) }
  })

  test('does not retry a protected request after its session was replaced', async () => {
    const refresh = deferred()
    fetchMock.mockImplementation(url => url.endsWith('/auth/refresh')
      ? refresh.promise : Promise.resolve(jsonResponse({ detail: 'Expired' }, 401)))
    const result = apiRequest('/me/cart').catch(reason => reason)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    resetSession(false)
    refresh.resolve(jsonResponse({}))
    expect(await result).toMatchObject({ status: 401, message: expect.stringContaining('session has ended') })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

test.each(['javascript:alert(1)', 'data:text/html,hello', null, ''])('rejects unsafe or empty media URL %s', value => {
  expect(mediaUrl(value)).toBe('')
})

test('resolves relative backend media URLs', () => {
  expect(mediaUrl('/uploads/avatar.webp')).toBe('http://localhost/uploads/avatar.webp')
})
