import { apiRequest, mediaUrl } from './client'
const idPath = id => {
  const number = Number(id)
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(number) || number < 1) throw new Error('Enter a valid positive user ID.')
  return encodeURIComponent(number)
}
function profile(user) {
  if (!user || user.id == null || typeof user.username !== 'string') throw new Error('Could not read a friend profile.')
  return { ...user, avatar: mediaUrl(user.avatar) }
}
function requestItem(item) {
  if (!item || item.id == null) throw new Error('Could not read a friend request.')
  return { ...item, sender: item.sender ? profile(item.sender) : null, receiver: item.receiver ? profile(item.receiver) : null }
}
async function list(path, transform, signal) {
  const data = await apiRequest(path, { signal })
  if (!Array.isArray(data)) throw new Error('Could not read the friends list.')
  return data.map(transform)
}
export const getFriends = signal => list('/friends', profile, signal)
export const getIncomingRequests = signal => list('/friends/requests/incoming', requestItem, signal)
export const getOutgoingRequests = signal => list('/friends/requests/outgoing', requestItem, signal)
export const removeFriend = (id, signal) => apiRequest('/friends/' + idPath(id), { method: 'DELETE', signal })
export async function sendFriendRequest(receiverId, signal) {
  idPath(receiverId)
  return requestItem(await apiRequest('/friends/requests', { method: 'POST', body: { receiver_id: Number(receiverId) }, signal }))
}
export const acceptFriendRequest = (id, signal) => apiRequest('/friends/requests/' + idPath(id) + '/accept', { method: 'POST', signal })
export const declineFriendRequest = (id, signal) => apiRequest('/friends/requests/' + idPath(id) + '/decline', { method: 'POST', signal })
export const cancelFriendRequest = (id, signal) => apiRequest('/friends/requests/' + idPath(id), { method: 'DELETE', signal })
export function friendError(error) {
  const messages = {
    'cannot send friend request to yourself': 'You cannot add yourself.',
    'already friends': 'This user is already your friend.',
    'friend request already sent': 'You have already sent this user a request.',
    'user not found': 'No user with this ID was found.',
    'friend request not found': 'This request is no longer available. Refresh the lists.',
    'friendship not found': 'This user is no longer in your friends list.',
    'request is not pending': 'This request has already been handled. Refresh the lists.',
  }
  return messages[error.message?.toLowerCase()] || (error instanceof TypeError ? 'Could not connect. Please try again.' : error.message) || 'Could not update friends. Please try again.'
}
