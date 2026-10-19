import { apiRequest, ApiError, mediaUrl } from './client'
function normalizeNews(item) {
  if (!item || item.id == null || typeof item.title !== 'string')
    throw new Error('The server returned an invalid news item.')
  return {
    ...item,
    banner_url: mediaUrl(item.banner_url),
    content_md: typeof item.content_md === 'string' ? item.content_md : '',
  }
}
export async function getNews({ skip = 0, limit = 12, game_id } = {}, signal) {
  if (!Number.isInteger(skip) || skip < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid news pagination.')
  const query = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  if (game_id != null && game_id !== '') {
    query.set('game_id', String(game_id).trim())
  }
  const data = await apiRequest('/news?' + query, { signal, auth: false })
  if (!Array.isArray(data)) throw new Error('The server returned an invalid news list.')
  return data.map(normalizeNews)
}
export async function getNewsById(id, signal) {
  if (!/^\d+$/.test(String(id))) throw new ApiError('News not found.', 404)
  const data = await apiRequest('/news/' + encodeURIComponent(id), { signal, auth: false })
  return normalizeNews(data)
}
