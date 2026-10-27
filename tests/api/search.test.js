import { expect, test, vi } from 'vitest'
import { searchReviews, searchUsers } from '../../src/api/search'
import { jsonResponse } from '../helpers'

test('people search uses public requests and an explicit field allowlist, even if the server includes email', async () => {
  localStorage.setItem('vstore:token', 'private-token')
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 7, username: 'reader', full_name: 'Reader One', role_name: 'user', email: 'private@example.com', pending_email: 'other@example.com', phone: 'secret' }])))
  expect(await searchUsers(' reader & friend? ')).toEqual([{ id: 7, username: 'reader', fullName: 'Reader One', role: 'user' }])
  const [url, options] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/search/users?q=reader+%26+friend%3F')
  expect(options.credentials).toBe('omit')
  expect(options.headers.Authorization).toBeUndefined()
})

test('review search retains text, negative verdicts and context, and handles absent optional fields', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([
    { id: 5, content_md: '**Great** story', is_positive: false, game_id: 'game-uuid', user_id: 7, created_at: '2026-10-20T12:00:00Z' },
    { id: 6, content_md: 'Another review', game_id: null, user_id: {}, created_at: 'invalid' },
  ])))
  const result = await searchReviews('story')
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/search/reviews?q=story')
  expect(result[0]).toMatchObject({ id: 5, content: '**Great** story', positive: false, gameId: 'game-uuid', userId: 7, createdAt: '2026-10-20T12:00:00Z' })
  expect(result[1]).toMatchObject({ positive: null, gameId: '', userId: null, createdAt: '' })
})

test.each([['people', searchUsers], ['reviews', searchReviews]])('%s search skips empty queries, limits length and forwards cancellation', async (_name, search) => {
  const fetchMock = vi.fn(async () => jsonResponse([]))
  vi.stubGlobal('fetch', fetchMock)
  expect(await search('   ')).toEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
  const controller = new AbortController()
  await search('x'.repeat(250), controller.signal)
  const [url, options] = fetchMock.mock.calls[0]
  expect(new URL(url, 'http://localhost').searchParams.get('q')).toHaveLength(200)
  controller.abort()
  expect(options.signal.aborted).toBe(true)
})

test.each([
  [searchUsers, {}], [searchUsers, [null]], [searchUsers, [{ id: -1, username: 'bad' }]],
  [searchReviews, {}], [searchReviews, [null]], [searchReviews, [{ id: 5, content_md: {} }]],
])('rejects malformed search results rather than rendering a broken card', async (search, data) => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(data)))
  await expect(search('query')).rejects.toThrow(/invalid/)
})
