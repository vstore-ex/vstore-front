import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import AddToCartButton from '../src/components/Cart/AddToCartButton'
import ProductReviews from '../src/pages/ProductDetailPage/ProductReviews'
import { AuthContext } from '../src/auth/context'
import { CartContext } from '../src/cart/context'
import { OrdersContext } from '../src/orders/context'
import { CurrencyContext } from '../src/currency/context'
import * as reviewsApi from '../src/api/reviews'
import { deferred } from './helpers'

vi.mock('../src/api/reviews', async (original) => ({
  ...(await original()),
  getReviews: vi.fn(),
  getReviewSummary: vi.fn(),
  createReview: vi.fn(),
}))
const addToCart = vi.fn()
const retryLibrary = vi.fn()
const signIn = vi.fn()
function Product({
  items = [],
  ownedIds = [],
  error = '',
  loading = false,
  gameId = '1',
  userId = 7,
  reviews = false,
}) {
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: userId != null,
        currentUser: userId == null ? null : { id: userId, username: 'player' },
      }}
    >
      <CurrencyContext.Provider value={{ code: 'USD' }}>
        <CartContext.Provider value={{ items, busy: false, addToCart }}>
          <OrdersContext.Provider value={{ ownedIds, loading, error, retry: retryLibrary }}>
            {reviews ? (
              <ProductReviews id={gameId} onSignIn={signIn} />
            ) : (
              <AddToCartButton gameId={gameId} />
            )}
          </OrdersContext.Provider>
        </CartContext.Provider>
      </CurrencyContext.Provider>
    </AuthContext.Provider>
  )
}
beforeEach(() => {
  addToCart.mockReset().mockResolvedValue(true)
  retryLibrary.mockReset()
  signIn.mockReset()
  reviewsApi.getReviews.mockReset().mockResolvedValue([])
  reviewsApi.getReviewSummary.mockReset().mockResolvedValue({ total: 0, percentage: 0 })
  reviewsApi.createReview.mockReset()
})

test('a game already in the cart remains accessible when library checking fails', async () => {
  render(<Product items={[{ game_id: 1 }]} error="Orders unavailable" />)
  expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('link', { name: 'View cart' }))
  expect(window.location.hash).toBe('#/cart')
  expect(addToCart).not.toHaveBeenCalled()
})

test('confirmed ownership takes precedence over stale cart contents and library refresh errors', () => {
  render(<Product items={[{ game_id: 1 }]} ownedIds={['1']} error="Orders unavailable" />)
  expect(screen.getByRole('link', { name: 'View library' })).toHaveAttribute('href', '#/library')
  expect(screen.queryByRole('link', { name: 'View cart' })).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('library failure replaces an old add error; retry clears it without bypassing ownership checks', async () => {
  const user = userEvent.setup()
  addToCart.mockRejectedValueOnce({ status: 400, message: 'already in cart' })
  const { rerender } = render(<Product />)
  await user.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This game is already in your cart.')
  rerender(<Product error="Orders unavailable" />)
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not check your library.')
  expect(screen.queryByText('This game is already in your cart.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retryLibrary).toHaveBeenCalledOnce()
  rerender(<Product loading />)
  expect(screen.getByRole('button', { name: 'Checking library...' })).toBeDisabled()
  rerender(<Product />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
})

test('cart reconciliation and subsequent removal do not restore a stale add error', async () => {
  addToCart.mockRejectedValueOnce({ status: 400, message: 'already in cart' })
  const { rerender } = render(<Product />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Add to cart' }))
  await screen.findByRole('alert')
  rerender(<Product items={[{ game_id: '1' }]} />)
  expect(screen.getByRole('link', { name: 'View cart' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  rerender(<Product />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
})

test.each([{ gameId: '2' }, { userId: 8 }])(
  'does not carry add errors into another product/session: %j',
  async (next) => {
    addToCart.mockRejectedValueOnce(new Error('Connection failed'))
    const { rerender } = render(<Product />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add to cart' }))
    await screen.findByRole('alert')
    rerender(<Product {...next} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  },
)

test('review button opens the editor, cancels and publishes without a second toggle during submission', async () => {
  const user = userEvent.setup()
  const request = deferred()
  reviewsApi.createReview.mockReturnValueOnce(request.promise)
  render(<Product reviews ownedIds={['1']} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Write a review' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'Write a review' }))
  expect(screen.getByRole('form', { name: 'Write a review' })).toBeInTheDocument()
  expect(screen.queryByText(/must own this game/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Write a review' }))
  await user.type(screen.getByRole('textbox', { name: 'Your review' }), 'A great adventure.')
  await user.click(screen.getByRole('button', { name: 'Post review' }))
  expect(screen.queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  await act(async () =>
    request.resolve({
      id: 21,
      content_md: 'A great adventure.',
      is_positive: true,
      helpful_count: 0,
      funny_count: 0,
    }),
  )
  expect(screen.getByText('Your review was posted.')).toBeInTheDocument()
  expect(screen.getByText('You already left a review for this game.')).toBeInTheDocument()
  expect(within(screen.getByRole('article')).getByText('A great adventure.')).toBeInTheDocument()
  expect(reviewsApi.createReview).toHaveBeenCalledOnce()
})

test.each([{ userId: null }, {}, { error: 'Orders unavailable' }, { loading: true }])(
  'keeps paid-game review access restricted: %j',
  async (state) => {
    render(<Product reviews {...state} />)
    await screen.findByText('No reviews for this game yet. Be the first!')
    expect(screen.queryByRole('button', { name: 'Write a review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  },
)
