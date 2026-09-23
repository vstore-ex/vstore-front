import { apiRequest } from './client'
const productPath = id => {
  if (!/^\d+$/.test(String(id))) throw new Error('This game is not available in the server catalog.')
  return '/me/cart/' + encodeURIComponent(id)
}
export const getCart = signal => apiRequest('/me/cart', { signal })
export const addToCart = id => apiRequest(productPath(id), { method: 'POST' })
export const removeFromCart = id => apiRequest(productPath(id), { method: 'DELETE' })
export const clearCart = () => apiRequest('/me/cart', { method: 'DELETE' })
export const createOrder = (method, termsAccepted) => apiRequest('/me/orders/', {
  method: 'POST', body: { payment_method: method, terms_accepted: termsAccepted },
})
export const getOrders = signal => apiRequest('/me/orders/', { signal })
export function formatMoney(value, currency = 'UAH') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(value))
}
export function cartError(error) {
  if (error.status === 400 && /already in cart/i.test(error.message)) return 'This game is already in your cart.'
  if (error.status === 400 && /cart is empty/i.test(error.message)) return 'Your cart is empty. Add a game before placing an order.'
  if (error.status === 404) return 'This game is no longer available in your cart or catalog.'
  if (error.status >= 500) return 'The server could not complete this action. Please try again.'
  return error.message || 'Could not connect to the store. Please try again.'
}
