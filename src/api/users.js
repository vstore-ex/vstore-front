import { apiRequest, ApiError, mediaUrl } from './client'
function userPath(id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)
    throw new ApiError('User not found.', 404)
  return '/users/' + encodeURIComponent(id)
}
const text = (value) => (typeof value === 'string' ? value : '')
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null)
export async function getUserById(id, signal) {
  const data = await apiRequest(userPath(id), { signal, auth: false })
  if (!data || String(data.id) !== String(Number(id)) || typeof data.username !== 'string')
    throw new Error('Could not read this user profile.')
  return {
    id: data.id,
    username: data.username,
    full_name: text(data.full_name),
    avatar: mediaUrl(data.avatar),
    role_name: text(data.role_name),
    created_at: text(data.created_at),
    is_blocked_by_viewer: data.is_blocked_by_viewer === true,
    stats: Object.fromEntries(
      ['games', 'achievements', 'wishlist'].map((key) => [key, count(data.stats?.[key])]),
    ),
  }
}
export async function blockUser(id, signal) {
  const data = await apiRequest(userPath(id) + '/block', { method: 'POST', signal })
  if (!Number.isSafeInteger(data?.id) || String(data.id) !== String(Number(id)))
    throw new Error('Could not block this user.')
  return data
}
export async function unblockUser(id, signal) {
  await apiRequest(userPath(id) + '/block', { method: 'DELETE', signal })
}
export async function getBlockedUsers(signal) {
  const data = await apiRequest('/users/me/blocked', { signal })
  if (!Array.isArray(data)) throw new Error('Could not read the blocked list.')
  return data.map((item) => {
    if (!Number.isSafeInteger(item?.id) || typeof item.username !== 'string')
      throw new Error('Could not read the blocked list.')
    return {
      id: item.id,
      username: item.username,
      full_name: text(item.full_name),
      avatar: mediaUrl(item.avatar),
      blocked_at: text(item.blocked_at),
    }
  })
}
