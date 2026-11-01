import { expect, test, vi } from 'vitest'
import {
  deleteComment,
  deleteCommunityItem,
  getComments,
  getCommunityItem,
  getGameArtworks,
  getGameDiscussions,
  saveComment,
  saveCommunityItem,
  uploadArtworkImage,
  validateArtworkFile,
} from '../../src/api/community'
import { jsonResponse } from '../helpers'

const discussion = {
  id: 1,
  game_id: 'game-a',
  thread_id: 101,
  author_id: 7,
  username: 'player',
  title: 'Topic',
  content_md: 'Hello',
  created_at: '2026-10-29T12:00:00Z',
}
const artwork = {
  ...discussion,
  id: 2,
  thread_id: 201,
  title: 'Art',
  image_url: '/media/art.webp',
  description_md: null,
}
const comment = {
  id: 3,
  thread_id: 101,
  author_id: 7,
  username: 'player',
  content_md: 'Hello',
  created_at: discussion.created_at,
}

test('public lists and details omit credentials and accept cancellation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      jsonResponse(
        url.includes('/artworks')
          ? [artwork]
          : url.includes('/threads')
            ? [comment]
            : url.endsWith('/discussions/1')
              ? discussion
              : [discussion],
      ),
    ),
  )
  const controller = new AbortController()
  await getGameDiscussions('game-a', controller.signal)
  await getGameArtworks('game-a')
  await getCommunityItem('discussion', 1)
  await getComments(101, { skip: 20, limit: 20 })
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/community/games/game-a/discussions',
    '/api/v1/artworks/game/game-a',
    '/api/v1/community/discussions/1',
    '/api/v1/community/threads/101/comments?skip=20&limit=20',
  ])
  expect(
    fetch.mock.calls.every(
      ([, options]) => options.credentials === 'omit' && !options.headers.Authorization,
    ),
  ).toBe(true)
  controller.abort()
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
})

test('discussion/artwork/comment writes use the exact authenticated backend payloads', async () => {
  localStorage.setItem('vstore:token', 'test-token')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) =>
      jsonResponse(
        options.method === 'DELETE'
          ? null
          : url.includes('/artworks')
            ? artwork
            : url.includes('/comments')
              ? comment
              : discussion,
        options.method === 'DELETE' ? 204 : 200,
      ),
    ),
  )
  await saveCommunityItem('discussion', {
    game_id: 'game-a',
    title: ' Topic ',
    content_md: ' Hello ',
  })
  await saveCommunityItem('discussion', { id: 1, title: 'Edited', content_md: 'Changed' })
  await saveCommunityItem('artwork', {
    game_id: 'game-a',
    title: 'Art',
    image_url: '/media/art.webp',
    description_md: '',
  })
  await saveCommunityItem('artwork', {
    id: 2,
    title: 'Art',
    image_url: '/media/art.webp',
    description_md: 'Updated',
  })
  await saveComment(101, { content_md: 'Hello' })
  await saveComment(101, { id: 3, content_md: 'Edited' })
  await deleteComment(3)
  await deleteCommunityItem('discussion', 1)
  await deleteCommunityItem('artwork', 2)
  expect(fetch.mock.calls.map(([url, options]) => [url, options.method])).toEqual([
    ['/api/v1/community/discussions', 'POST'],
    ['/api/v1/community/discussions/1', 'PUT'],
    ['/api/v1/artworks/', 'POST'],
    ['/api/v1/artworks/2', 'PUT'],
    ['/api/v1/community/threads/101/comments', 'POST'],
    ['/api/v1/community/comments/3', 'PUT'],
    ['/api/v1/community/comments/3', 'DELETE'],
    ['/api/v1/community/discussions/1', 'DELETE'],
    ['/api/v1/artworks/2', 'DELETE'],
  ])
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    game_id: 'game-a',
    title: 'Topic',
    content_md: 'Hello',
  })
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    title: 'Edited',
    content_md: 'Changed',
  })
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
    game_id: 'game-a',
    title: 'Art',
    image_url: '/media/art.webp',
    description_md: '',
  })
  expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({ content_md: 'Hello' })
  expect(
    fetch.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer test-token'),
  ).toBe(true)
})

test.each([true, false, undefined])(
  'preserves the thread status %s on both public community resource types',
  async (isClosed) => {
    const topic = { ...discussion, is_closed: isClosed }
    const art = { ...artwork, is_closed: isClosed }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/community/discussions/1')) return jsonResponse(topic)
        if (url.endsWith('/artworks/2')) return jsonResponse(art)
        return jsonResponse(url.includes('/artworks/') ? [art] : [topic])
      }),
    )
    const expected = isClosed ?? null
    expect((await getCommunityItem('discussion', 1)).is_closed).toBe(expected)
    expect((await getCommunityItem('artwork', 2)).is_closed).toBe(expected)
    expect((await getGameDiscussions('game-a'))[0].is_closed).toBe(expected)
    expect((await getGameArtworks('game-a'))[0].is_closed).toBe(expected)
  },
)

test('uploads authenticated multipart file and normalizes the resulting media URL', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ url: '/media/new.webp', filename: 'new.webp' })),
  )
  const file = new File(['image'], 'art.png', { type: 'image/png' })
  const url = await uploadArtworkImage(file)
  expect(url).toBe('http://localhost/media/new.webp')
  const [path, options] = fetch.mock.calls[0]
  expect(path).toBe('/api/v1/media/upload')
  expect(options.body.get('file')).toBe(file)
  expect(options.headers['Content-Type']).toBeUndefined()
  expect(options.credentials).toBe('include')
})

test.each([
  new File(['svg'], 'art.svg', { type: 'image/svg+xml' }),
  new File([], 'empty.png', { type: 'image/png' }),
  new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
])('rejects invalid artwork before upload %#', async (file) => {
  expect(() => validateArtworkFile(file)).toThrow()
  await expect(uploadArtworkImage(file)).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})

test.each([{}, { url: 'javascript:alert(1)' }, { url: 'data:image/svg+xml,x' }])(
  'rejects unconfirmed or unsafe upload results %#',
  async (result) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(result)),
    )
    await expect(
      uploadArtworkImage(new File(['image'], 'art.png', { type: 'image/png' })),
    ).rejects.toThrow('could not be confirmed')
  },
)

test('rejects invalid text, list payloads, duplicate records, and cross-game/thread responses', async () => {
  await expect(
    saveCommunityItem('discussion', { game_id: 'game-a', title: ' ', content_md: 'hello' }),
  ).rejects.toThrow('Title')
  await expect(saveComment(101, { content_md: ' ' })).rejects.toThrow('Comment')
  await expect(getComments(101, { skip: -1 })).rejects.toThrow('pagination')
  expect(fetch).not.toHaveBeenCalled()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse([discussion, discussion])),
  )
  await expect(getGameDiscussions('game-a')).rejects.toThrow('list')
  fetch.mockResolvedValueOnce(jsonResponse([{ ...discussion, game_id: 'game-b' }]))
  await expect(getGameDiscussions('game-a')).rejects.toThrow('game')
  fetch.mockResolvedValueOnce(jsonResponse([{ ...comment, thread_id: 99 }]))
  await expect(getComments(101)).rejects.toThrow('thread')
  fetch.mockResolvedValueOnce(jsonResponse({ items: [] }))
  await expect(getGameArtworks('game-a')).rejects.toThrow('list')
})
