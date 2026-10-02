import { apiRequest, mediaUrl } from './client'
export const REVIEW_MAX_LENGTH = 10000
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const idPath = value => {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('Invalid review or game ID.')
  return encodeURIComponent(value)
}
export function normalizeReview(item, gameId) {
  if (!item || item.id == null || typeof item.is_positive !== 'boolean' || typeof item.content_md !== 'string') throw new Error('Could not read a review.')
  const user = item.user || {}
  const rawReactions = typeof item.reactions_count === 'object' && item.reactions_count !== null ? item.reactions_count : {}
  const reactions_count = Object.fromEntries(
    Object.entries(rawReactions).filter(([, v]) => Number.isSafeInteger(v) && v >= 0)
  )
  return { id: item.id, game_id: item.game_id ?? gameId, user_id: user.id ?? item.user_id,
    username: typeof user.username === 'string' ? user.username : typeof item.username === 'string' ? item.username : '',
    avatar: mediaUrl(user.avatar ?? item.avatar), is_positive: item.is_positive, content_md: item.content_md,
    created_at: typeof item.created_at === 'string' ? item.created_at : '',
    reactions_count,
    user_reaction: typeof item.user_reaction === 'string' ? item.user_reaction : null,
    helpful_count: count(item.helpful_count) ?? reactions_count.helpful ?? null,
    funny_count: count(item.funny_count) ?? reactions_count.funny ?? null }
}
export async function getReviews(gameId, { skip = 0, limit = 7 } = {}, signal) {
  if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid review pagination.')
  const data = await apiRequest('/games/' + idPath(gameId) + '/reviews?' + new URLSearchParams({ skip, limit }), { signal })
  if (!Array.isArray(data)) throw new Error('Could not read reviews.')
  return data.map(item => normalizeReview(item, gameId))
}
function payload(value) {
  const content = value.content_md?.trim()
  if (!content || content.length > REVIEW_MAX_LENGTH || typeof value.is_positive !== 'boolean') throw new Error('Enter a review between 1 and ' + REVIEW_MAX_LENGTH + ' characters.')
  return { content_md: content, is_positive: value.is_positive }
}
export async function createReview(gameId, value, signal) {
  return normalizeReview(await apiRequest('/games/' + idPath(gameId) + '/reviews', { method: 'POST', body: payload(value), signal }), gameId)
}
export async function updateReview(reviewId, value, signal) {
  return normalizeReview(await apiRequest('/reviews/' + idPath(reviewId), { method: 'PATCH', body: payload(value), signal }))
}
export function reactToReview(reviewId, reactionType, signal) {
  if (typeof reactionType !== 'string' || !reactionType.trim()) throw new Error('Invalid reaction type.')
  return apiRequest('/reviews/' + idPath(reviewId) + '/reaction', { method: 'POST', body: { reaction_type: reactionType.trim() }, signal })
}
// The list contract has no aggregate fields. Count all pages independently of the visible feed.
// Replace this traversal with a server aggregate when the backend exposes one.
export async function getReviewSummary(gameId, signal) {
  const reviews = new Map()
  for (let skip = 0; ; skip += 100) {
    const page = await getReviews(gameId, { skip, limit: 100 }, signal)
    const previousSize = reviews.size
    page.forEach(item => reviews.set(String(item.id), item.is_positive))
    if (page.length < 100) break
    if (reviews.size === previousSize) throw new Error('Could not calculate the review summary.')
  }
  const total = reviews.size
  const positive = [...reviews.values()].filter(Boolean).length
  return { total, positive, percentage: total ? Math.round(positive / total * 100) : null }
}
export function reviewError(error) {
  if (error.status === 400 && /already|duplicate/i.test(error.message)) return 'You already left a review for this game.'
  if (error.status === 401) return 'Please sign in to continue.'
  if (error.status === 403 && !error.banned) return 'You must own this game to post a review.'
  return error instanceof TypeError ? 'Could not connect. Please try again.' : error.message || 'Could not save your review. Please try again.'
}
