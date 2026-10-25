import { apiRequest } from './client'
import { walletError } from './wallet'
import { isMoneyAmount } from '../utils/money'
export { formatMoney } from '../utils/money'
const gamePath = (id) => {
  if (!id || (typeof id !== 'string' && typeof id !== 'number'))
    throw new Error('This game is not available in the server catalog.')
  return '/me/cart/' + encodeURIComponent(String(id).trim())
}
const validAmount = (value) => isMoneyAmount(value) && Number(value) >= 0
export async function getCart(signal) {
  const data = await apiRequest('/me/cart', { signal })
  if (
    !data ||
    !Array.isArray(data.items) ||
    typeof data.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(data.currency) ||
    ['subtotal', 'tax', 'total'].some((key) => !validAmount(data[key])) ||
    data.items.some(
      (item) =>
        !item ||
        item.game_id == null ||
        !String(item.game_id).trim() ||
        typeof item.title !== 'string' ||
        !validAmount(item.price),
    )
  ) {
    throw new Error('The server returned an invalid cart.')
  }
  return data
}
export const addToCart = (id) => apiRequest(gamePath(id), { method: 'POST' })
export const removeFromCart = (id) => apiRequest(gamePath(id), { method: 'DELETE' })
export const clearCart = () => apiRequest('/me/cart', { method: 'DELETE' })
export const createOrder = (method, termsAccepted) =>
  apiRequest('/me/orders/', {
    method: 'POST',
    body: { payment_method: method, terms_accepted: termsAccepted },
  })
export const getOrders = (signal) => apiRequest('/me/orders/', { signal })
export function cartError(error) {
  if (/insufficient wallet|wallet.*frozen/i.test(error.message)) return walletError(error)
  if (error.status === 400 && /already own/i.test(error.message))
    return 'You already own this game in your library.'
  if (error.status === 400 && /already in cart/i.test(error.message))
    return 'This game is already in your cart.'
  if (error.status === 400 && /cart is empty/i.test(error.message))
    return 'Your cart is empty. Add a game before placing an order.'
  if (error.status === 403 && /purchases are disabled/i.test(error.message))
    return 'Purchases are disabled for your account role.'
  if (error.status === 404) return 'This game is no longer available in your cart or catalog.'
  if (error.status === 409)
    return 'An order is already being processed for your account. Please wait a moment.'
  if (error.status === 429) return 'Too many requests. Please wait a moment before trying again.'
  if (error.status >= 500) return 'The server could not complete this action. Please try again.'
  return error.message || 'Could not connect to the store. Please try again.'
}
