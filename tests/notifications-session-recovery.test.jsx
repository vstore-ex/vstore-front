import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { resetSession } from '../src/api/client'
import { AuthContext } from '../src/auth/context'
import NotificationsProvider from '../src/notifications/NotificationsProvider'
import { jsonResponse } from './helpers'

let sockets
let accessExpired
let sessionRecovered
let fetchMock

class FakeWebSocket {
  constructor() {
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.recoveredBeforeConnect = sessionRecovered
    sockets.push(this)
  }

  close(event = { code: 1000 }) {
    this.onclose?.(event)
  }
}

beforeEach(() => {
  resetSession()
  localStorage.clear()
  localStorage.setItem('vstore:token', 'initial-access-token')
  sockets = []
  accessExpired = false
  sessionRecovered = false
  vi.stubGlobal('WebSocket', FakeWebSocket)
  fetchMock = vi.fn(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      expect(options.credentials).toBe('include')
      sessionRecovered = true
      return jsonResponse({ access_token: 'refreshed-access-token' })
    }
    if (url.endsWith('/notifications?limit=20')) {
      if (accessExpired && options.headers.Authorization !== 'Bearer refreshed-access-token') {
        return jsonResponse({ detail: 'Expired access token' }, 401)
      }
      return jsonResponse({ items: [], total: 0, unread_count: 0 })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

test('refreshes an expired socket session before reconnecting while the tab is hidden', async () => {
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  const { unmount } = render(
    <AuthContext.Provider value={{ currentUser: { id: 7 } }}>
      <NotificationsProvider />
    </AuthContext.Provider>,
  )

  try {
    await waitFor(() => expect(sockets).toHaveLength(1))
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/notifications?limit=20'))).toHaveLength(
        1,
      ),
    )
    await act(async () => sockets[0].onopen())
    accessExpired = true
    await act(async () => sockets[0].close({ code: 1008 }))

    await waitFor(() => expect(sessionRecovered).toBe(true), { timeout: 4000 })
    await waitFor(() => expect(sockets).toHaveLength(2), { timeout: 4000 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(localStorage.getItem('vstore:token')).toBe('refreshed-access-token')
    expect(sockets[1].recoveredBeforeConnect).toBe(true)
  } finally {
    unmount()
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility)
    else delete document.visibilityState
  }
})
