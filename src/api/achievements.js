import { apiRequest, mediaUrl } from './client'
function normalizeAchievement(item) {
  const title = item?.name ?? item?.title
  if (!item || item.id == null || typeof title !== 'string')
    throw new Error('Could not read an achievement.')
  const percent = item.percent_unlocked ?? item.completion_percent
  return {
    id: item.id,
    title,
    description: typeof item.description === 'string' ? item.description : '',
    icon: mediaUrl(item.icon_url ?? item.icon),
    game_id: item.game_id,
    completion:
      typeof percent === 'number' && Number.isFinite(percent)
        ? Math.max(0, Math.min(100, percent))
        : null,
    unlocked: typeof item.unlocked === 'boolean' ? item.unlocked : null,
    unlocked_at: typeof item.unlocked_at === 'string' ? item.unlocked_at : '',
  }
}
export async function getGameAchievements(gameId, { page = 1, pageSize = 11 } = {}, signal) {
  if (gameId == null || !String(gameId).trim()) throw new Error('A game ID is required.')
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new Error('Invalid achievement pagination.')
  const query = new URLSearchParams({ page, page_size: pageSize })
  const data = await apiRequest('/games/' + encodeURIComponent(gameId) + '/achievements?' + query, {
    signal,
    auth: false,
  })
  // The deployed parser contract is paginated; also accept the array contract in the public API brief.
  if (Array.isArray(data))
    return {
      items: data.slice((page - 1) * pageSize, page * pageSize).map(normalizeAchievement),
      total: data.length,
      page,
    }
  if (!Array.isArray(data?.items) || !Number.isSafeInteger(data.total) || data.total < 0)
    throw new Error('Could not read achievements.')
  return { items: data.items.map(normalizeAchievement), total: data.total, page: data.page ?? page }
}
export async function getUserAchievements(userId, signal) {
  if (!/^\d+$/.test(String(userId)) || !Number.isSafeInteger(Number(userId)) || Number(userId) < 1)
    throw new Error('A valid user ID is required.')
  const data = await apiRequest('/users/' + encodeURIComponent(userId) + '/achievements', {
    signal,
    auth: false,
  })
  if (!Array.isArray(data)) throw new Error('Could not read unlocked achievements.')
  const timestamp = (item) => Date.parse(item.unlocked_at) || 0
  return data
    .map(normalizeAchievement)
    .filter((item) => item.unlocked !== false)
    .sort((a, b) => timestamp(b) - timestamp(a))
}
