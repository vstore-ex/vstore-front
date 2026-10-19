import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiRequest } from '../../src/api/client'
import { createReview, getReviews, normalizeReview, reactToReview, reviewError, updateReview } from '../../src/api/reviews'

vi.mock('../../src/api/client', async importOriginal => ({
  ...await importOriginal(), apiRequest: vi.fn(),
}))

const review = overrides => ({
  id: 8, is_positive: true, content_md: '**Recommended**', created_at: '2026-10-19T10:00:00Z',
  user: { id: 3, username: 'Reader', avatar: '/uploads/avatar.webp' }, ...overrides,
})
beforeEach(() => apiRequest.mockReset())

describe('review normalization', () => {
  test('preserves the author, Markdown, recommendation and selected reaction', () => {
    expect(normalizeReview(review({ helpful_count: 0, funny_count: 2, user_reaction: 'funny' }), 'game-1')).toMatchObject({
      id: 8, game_id: 'game-1', user_id: 3, username: 'Reader', avatar: 'http://localhost/uploads/avatar.webp',
      content_md: '**Recommended**', is_positive: true, helpful_count: 0, funny_count: 2, user_reaction: 'funny',
      created_at: '2026-10-19T10:00:00Z',
    })
  })

  test('accepts legacy author fields and filters malformed reaction counts', () => {
    expect(normalizeReview(review({
      user: null, user_id: 4, username: 'Legacy', avatar: 'javascript:alert(1)',
      helpful_count: -1, funny_count: '4', reactions_count: { helpful: 3, funny: 4, bad: -1, fraction: 1.5, text: '2' },
    }), 'game-2')).toMatchObject({
      user_id: 4, username: 'Legacy', avatar: '', helpful_count: 3, funny_count: 4,
      reactions_count: { helpful: 3, funny: 4 },
    })
  })

  test('uses safe optional defaults without inventing reaction counts', () => {
    expect(normalizeReview({ id: 1, is_positive: false, content_md: 'Review' }, 10)).toMatchObject({
      username: '', avatar: '', created_at: '', reactions_count: {}, helpful_count: null, funny_count: null, user_reaction: null,
    })
  })

  test.each([null, {}, review({ id: null }), review({ is_positive: 'yes' }), review({ content_md: {} })])(
    'rejects malformed review %#', value => expect(() => normalizeReview(value, 10)).toThrow('Could not read a review'),
  )
})

describe.each([
  ['create', (value) => createReview('game-1', value), '/games/game-1/reviews', 'POST'],
  ['update', (value) => updateReview(8, value), '/reviews/8', 'PATCH'],
])('%s validation', (_name, save, path, method) => {
  test.each([1, 10000])('accepts %i characters and sends the trimmed text', async length => {
    const content = 'a'.repeat(length)
    apiRequest.mockResolvedValue(review({ content_md: content }))
    await expect(save({ is_positive: false, content_md: '  ' + content + '\n' })).resolves.toMatchObject({ content_md: content })
    expect(apiRequest).toHaveBeenCalledWith(path, expect.objectContaining({
      method, body: { is_positive: false, content_md: content },
    }))
  })

  test.each(['', ' \n\t', 'a'.repeat(10001)])('rejects invalid content case %# before an API write', async content => {
    await expect(save({ is_positive: true, content_md: content })).rejects.toThrow('between 1 and 10000 characters')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  test('requires an explicit boolean recommendation', async () => {
    await expect(save({ is_positive: 'yes', content_md: 'Review' })).rejects.toThrow('between 1 and 10000 characters')
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

test('uses catalog pagination and normalizes returned reviews', async () => {
  const controller = new AbortController()
  apiRequest.mockResolvedValue([review()])
  await expect(getReviews('game-1', { skip: 6, limit: 6 }, controller.signal)).resolves.toMatchObject([{ id: 8, game_id: 'game-1' }])
  expect(apiRequest).toHaveBeenCalledWith('/games/game-1/reviews?skip=6&limit=6', { signal: controller.signal })
})

test.each([{ skip: -1 }, { limit: 0 }, { limit: 101 }])('rejects invalid pagination %j', async params => {
  await expect(getReviews('game-1', params)).rejects.toThrow('Invalid review pagination')
  expect(apiRequest).not.toHaveBeenCalled()
})

test.each(['helpful', 'funny'])('sends the %s reaction', async reaction => {
  apiRequest.mockResolvedValue({})
  await reactToReview(8, reaction)
  expect(apiRequest).toHaveBeenCalledWith('/reviews/8/reaction', expect.objectContaining({
    method: 'POST', body: { reaction_type: reaction },
  }))
})

test('makes duplicate, unauthenticated and network errors actionable', () => {
  expect(reviewError({ status: 400, message: 'already submitted' })).toBe('You already left a review for this game.')
  expect(reviewError({ status: 401 })).toBe('Please sign in to continue.')
  expect(reviewError(new TypeError('Failed to fetch'))).toBe('Could not connect. Please try again.')
})
