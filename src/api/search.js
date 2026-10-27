import { apiRequest } from './client'

const publicId = (value) =>
  /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0

async function search(path, query, normalize, signal) {
  const q = query.trim().slice(0, 200)
  if (!q) return []
  const data = await apiRequest(path + '?' + new URLSearchParams({ q }), {
    signal,
    auth: false,
    credentials: 'omit',
  })
  if (!Array.isArray(data)) throw new Error('The server returned invalid search results.')
  return data.map(normalize)
}

export function searchUsers(query, signal) {
  return search(
    '/search/users',
    query,
    (user) => {
      if (!publicId(user?.id) || typeof user.username !== 'string' || !user.username.trim())
        throw new Error('The server returned an invalid person in search results.')
      // Explicit public-field allowlist: never carry email or private profile fields into the UI.
      return {
        id: user.id,
        username: user.username,
        fullName: typeof user.full_name === 'string' ? user.full_name : '',
        role: typeof user.role_name === 'string' ? user.role_name : '',
      }
    },
    signal,
  )
}

export function searchReviews(query, signal) {
  return search(
    '/search/reviews',
    query,
    (review) => {
      if (!publicId(review?.id) || typeof review.content_md !== 'string')
        throw new Error('The server returned an invalid review in search results.')
      const gameId =
        typeof review.game_id === 'string'
          ? review.game_id.trim()
          : publicId(review.game_id)
            ? String(review.game_id)
            : ''
      return {
        id: review.id,
        content: review.content_md,
        positive: typeof review.is_positive === 'boolean' ? review.is_positive : null,
        gameId,
        userId: publicId(review.user_id) ? review.user_id : null,
        createdAt:
          typeof review.created_at === 'string' && Number.isFinite(Date.parse(review.created_at))
            ? review.created_at
            : '',
      }
    },
    signal,
  )
}
