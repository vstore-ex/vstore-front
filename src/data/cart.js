import { getProductById } from './products'

export const defaultCartProductIds = ['end-of-sun']

export function buildCartItems(productIds = defaultCartProductIds) {
  return productIds.map((productId) => getProductById(productId)).filter(Boolean)
}
