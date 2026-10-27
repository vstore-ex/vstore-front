import { expect, test, vi } from 'vitest'
import { getFriends, sendPresence } from '../../src/api/friends'
import { jsonResponse } from '../helpers'

test('presence heartbeat uses the authenticated backend endpoint with cancellation', async () => {
  localStorage.setItem('vstore:token', 'test-token')
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ user_id: 7, is_online: true })))
  const controller = new AbortController()
  await sendPresence(controller.signal)
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/friends/presence')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toEqual({ status: 'online' })
  expect(options.headers.Authorization).toBe('Bearer test-token')
  controller.abort()
  expect(options.signal.aborted).toBe(true)
})

test('friends normalize malformed presence fields without inventing online or offline state', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 8, username: 'friend', is_online: 'false', status: {}, activity: [], last_seen: null }])))
  expect((await getFriends())[0]).toMatchObject({ is_online: null, status: '', activity: '', last_seen: null })
})
