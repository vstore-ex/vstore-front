import { getProductById } from './products'

export const defaultWishlistProductIds = ['end-of-sun']

export function buildWishlistItems(productIds = defaultWishlistProductIds) {
  return productIds.map((productId) => getProductById(productId)).filter(Boolean)
}
