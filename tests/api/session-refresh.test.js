import { beforeEach, expect, test, vi } from 'vitest'
import { deferred, jsonResponse } from '../helpers'

let apiRequest, resetSession, refreshSession, waitForRefresh, fetchMock

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_BASE_URL', '/api/v1')
  ;({ apiRequest, resetSession, refreshSession, waitForRefresh } =
    await import('../../src/api/client'))
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

test('a refresh completing after logout cannot restore the previous access token', async () => {
  const pending = deferred()
  localStorage.setItem('vstore:token', 'old-token')
  fetchMock.mockImplementation((url) =>
    url.endsWith('/auth/refresh')
      ? pending.promise
      : Promise.resolve(jsonResponse({ detail: 'Expired' }, 401)),
  )
  const result = apiRequest('/me/cart').catch((error) => error)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  resetSession(false)
  localStorage.removeItem('vstore:token')
  pending.resolve(jsonResponse({ access_token: 'old-renewed-token' }))

  expect(await result).toMatchObject({ status: 401 })
  expect(localStorage.getItem('vstore:token')).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test.each([200, 401, 403, 503])(
  'a stale refresh response (%s) leaves the replacement session credentials and events alone',
  async (status) => {
    const pending = deferred()
    const expired = vi.fn()
    const banned = vi.fn()
    window.addEventListener('vstore:session-expired', expired)
    window.addEventListener('vstore:account-banned', banned)
    try {
      fetchMock.mockReturnValue(pending.promise)
      const result = refreshSession().catch((error) => error)
      resetSession()
      localStorage.setItem('vstore:token', 'replacement-token')
      pending.resolve(
        jsonResponse(
          status === 200 ? { access_token: 'old-token' } : { detail: 'Account banned' },
          status,
        ),
      )
      await result

      expect(localStorage.getItem('vstore:token')).toBe('replacement-token')
      expect(expired).not.toHaveBeenCalled()
      expect(banned).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('vstore:session-expired', expired)
      window.removeEventListener('vstore:account-banned', banned)
    }
  },
)

test.each([200, 401])(
  'new-session 401s wait for the old refresh (%s), then share their own refresh',
  async (oldStatus) => {
    const oldRefresh = deferred()
    const newRefresh = deferred()
    const refreshEvents = []
    const refreshing = (event) => refreshEvents.push(event.detail)
    window.addEventListener('vstore:refresh', refreshing)
    let refreshCount = 0
    fetchMock.mockImplementation((url, options) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1
        return refreshCount === 1 ? oldRefresh.promise : newRefresh.promise
      }
      return Promise.resolve(
        options.headers.Authorization === 'Bearer new-renewed'
          ? jsonResponse({ ok: true })
          : jsonResponse({ detail: 'Expired' }, 401),
      )
    })
    const oldRequest = apiRequest('/old-session').catch((error) => error)
    await vi.waitFor(() => expect(refreshCount).toBe(1))
    resetSession()
    localStorage.setItem('vstore:token', 'new-expired')
    const results = Promise.all([
      apiRequest('/me/cart').catch((error) => error),
      apiRequest('/wishlists/').catch((error) => error),
    ])
    try {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
      expect(refreshCount).toBe(1)
      oldRefresh.resolve(
        jsonResponse(
          oldStatus === 200 ? { access_token: 'old-renewed' } : { detail: 'Expired' },
          oldStatus,
        ),
      )
      expect(await oldRequest).toMatchObject({ status: 401 })
      await vi.waitFor(() => expect(refreshCount).toBe(2))
      expect(localStorage.getItem('vstore:token')).toBe('new-expired')
      expect(refreshEvents.at(-1)).toBe(true)
    } finally {
      newRefresh.resolve(jsonResponse({ access_token: 'new-renewed' }))
      window.removeEventListener('vstore:refresh', refreshing)
    }

    expect(await results).toEqual([{ ok: true }, { ok: true }])
    expect(localStorage.getItem('vstore:token')).toBe('new-renewed')
    expect(refreshCount).toBe(2)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/old-session')).toHaveLength(1)
  },
)

test('login and logout can still wait for the cookie refresh after a session reset', async () => {
  const pending = deferred()
  fetchMock.mockReturnValue(pending.promise)
  const refresh = refreshSession()
  resetSession(false)
  let settled = false
  const waiting = waitForRefresh().then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  pending.resolve(jsonResponse({ access_token: 'stale' }))
  await Promise.all([refresh, waiting])
  expect(settled).toBe(true)
})

test('a ban in the current refresh still removes its credentials', async () => {
  localStorage.setItem('vstore:token', 'banned-token')
  fetchMock.mockResolvedValue(jsonResponse({ detail: 'Account banned' }, 403))
  await expect(refreshSession()).rejects.toMatchObject({ status: 403, banned: true })
  expect(localStorage.getItem('vstore:token')).toBeNull()
})

test('a waiting request cannot start a refresh after its session is replaced again', async () => {
  const pending = deferred()
  fetchMock.mockImplementation((url) =>
    url.endsWith('/auth/refresh')
      ? pending.promise
      : Promise.resolve(jsonResponse({ detail: 'Expired' }, 401)),
  )
  const oldRefresh = refreshSession()
  resetSession()
  const intermediateRequest = apiRequest('/me/cart').catch((error) => error)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  resetSession()
  localStorage.setItem('vstore:token', 'latest-session')
  pending.resolve(jsonResponse({ access_token: 'obsolete' }))
  await oldRefresh
  expect(await intermediateRequest).toMatchObject({ status: 401 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(localStorage.getItem('vstore:token')).toBe('latest-session')
})

test('explicit refresh remains available for revoking all devices after local logout', async () => {
  resetSession(false)
  fetchMock.mockResolvedValue(jsonResponse({ access_token: 'logout-all-token' }))
  await refreshSession()
  expect(localStorage.getItem('vstore:token')).toBe('logout-all-token')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
