import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiRequest } from '../../src/api/client'
import { addToCart, cartError, clearCart, createOrder, formatMoney, getCart, removeFromCart } from '../../src/api/cart'

vi.mock('../../src/api/client', () => ({ apiRequest: vi.fn() }))
beforeEach(() => apiRequest.mockReset())

describe('cart API contract', () => {
  test('uses authenticated cart routes and forwards cancellation and purchase terms', async () => {
    const controller = new AbortController()
    apiRequest.mockResolvedValue({ items: [], currency: 'USD', subtotal: '0.00', tax: '0.00', total: '0.00' })
    await getCart(controller.signal)
    expect(apiRequest).toHaveBeenLastCalledWith('/me/cart', { signal: controller.signal })
    await addToCart('game/id')
    expect(apiRequest).toHaveBeenLastCalledWith('/me/cart/game%2Fid', { method: 'POST' })
    await removeFromCart(12)
    expect(apiRequest).toHaveBeenLastCalledWith('/me/cart/12', { method: 'DELETE' })
    await clearCart()
    expect(apiRequest).toHaveBeenLastCalledWith('/me/cart', { method: 'DELETE' })
    await createOrder('card', true)
    expect(apiRequest).toHaveBeenLastCalledWith('/me/orders/', {
      method: 'POST', body: { payment_method: 'card', terms_accepted: true },
    })
  })

  test.each([null, undefined, 0, {}])('rejects unusable game ID %s before sending a request', value => {
    expect(() => addToCart(value)).toThrow('not available')
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

test.each([
  ['1234.50', 'USD', '$1,234.50'],
  ['1234.50', 'EUR', '€1,234.50'],
  ['1234', 'JPY', '¥1,234'],
  [0, 'USD', '$0.00'],
  [0, 'JPY', '¥0'],
])('formats %s in %s with the correct currency', (amount, currency, expected) => {
  expect(formatMoney(amount, currency)).toBe(expected)
})

test.each([
  [400, 'already own this game', 'already own this game in your library'],
  [400, 'already in cart', 'already in your cart'],
  [400, 'cart is empty', 'Add a game before placing an order'],
  [403, 'purchases are disabled', 'disabled for your account role'],
  [404, 'missing', 'no longer available'],
  [409, 'conflict', 'already being processed'],
  [429, 'rate limited', 'Too many requests'],
  [503, 'internal error', 'server could not complete'],
])('normalizes cart error %s: %s', (status, message, expected) => {
  expect(cartError({ status, message })).toContain(expected)
})

test('preserves actionable server messages and supplies a fallback', () => {
  expect(cartError(new Error('Maintenance ends at 12:00'))).toBe('Maintenance ends at 12:00')
  expect(cartError({})).toBe('Could not connect to the store. Please try again.')
})
