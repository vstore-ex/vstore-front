import { apiRequest, ApiError, mediaUrl } from './client'
function userPath(id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new ApiError('User not found.', 404)
  return '/users/' + encodeURIComponent(id)
}
const text = value => typeof value === 'string' ? value : ''
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null
export async function getUserById(id, signal) {
  const data = await apiRequest(userPath(id), { signal, auth: false })
  if (!data || String(data.id) !== String(Number(id)) || typeof data.username !== 'string') throw new Error('Could not read this user profile.')
  return { id: data.id, username: data.username, full_name: text(data.full_name), avatar: mediaUrl(data.avatar),
    role_name: text(data.role_name), created_at: text(data.created_at),
    stats: Object.fromEntries(['games', 'achievements', 'wishlist'].map(key => [key, count(data.stats?.[key])])) }
}
export async function getUserAchievements(id, signal) {
  const data = await apiRequest(userPath(id) + '/achievements', { signal, auth: false })
  const items = Array.isArray(data) ? data : data?.items
  if (!Array.isArray(items)) throw new Error('Could not read unlocked achievements.')
  return items.map(item => {
    if (!item || item.id == null || typeof item.title !== 'string') throw new Error('Could not read an achievement.')
    return { id: item.id, title: item.title, description: text(item.description), icon: mediaUrl(item.icon),
      game_id: item.game_id, unlocked_at: text(item.unlocked_at) }
  })
}
