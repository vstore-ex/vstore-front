import { apiRequest } from './client'
import { mapGame } from './catalog'
const path = (id) => {
  if (!id || (typeof id !== 'string' && typeof id !== 'number'))
    throw new Error('This game is unavailable.')
  return '/wishlists/' + encodeURIComponent(String(id).trim())
}
export async function getWishlist(signal) {
  const data = await apiRequest('/wishlists/', { signal })
  if (!Array.isArray(data?.items) || data.items.some((item) => item?.game?.id == null))
    throw new Error('The server returned an invalid wishlist.')
  return data.items.map((item) => ({ ...mapGame(item.game), addedAt: item.added_at }))
}
export const addToWishlist = (id) => apiRequest(path(id), { method: 'POST' })
export const removeFromWishlist = (id) => apiRequest(path(id), { method: 'DELETE' })
export function wishlistError(error) {
  if (error.status === 400 && /already in wishlist/i.test(error.message))
    return 'This game is already in your wishlist.'
  if (error.status === 404) return 'This game is no longer available in your wishlist or catalog.'
  return error.message || 'Could not update your wishlist. Please try again.'
}
