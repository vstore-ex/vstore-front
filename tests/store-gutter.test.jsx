import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import StoreGutter from '../src/pages/DiscoverPage/StoreGutter'
import { AuthContext } from '../src/auth/context'
import { CartContext } from '../src/cart/context'
import { WalletContext } from '../src/wallet/context'
import { WishlistContext } from '../src/wishlist/context'

const tags = Array.from({ length: 11 }, (_, index) => ({
  id: index + 1,
  name: 'Tag ' + (index + 1),
}))

function renderGutter({ signedIn = false, tagData = tags, onBrowse = vi.fn() } = {}) {
  render(
    <AuthContext.Provider value={{ isAuthenticated: signedIn }}>
      <WalletContext.Provider value={{ data: { balance: '12.50', currency: 'USD' } }}>
        <WishlistContext.Provider value={{ count: 3 }}>
          <CartContext.Provider value={{ count: 0 }}>
            <StoreGutter tags={tagData} onBrowse={onBrowse} />
          </CartContext.Provider>
        </WishlistContext.Provider>
      </WalletContext.Provider>
    </AuthContext.Provider>,
  )
  return onBrowse
}

test('renders while tags are still loading', () => {
  renderGutter({ tagData: null })
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('navigation', { name: 'Popular tags' })).not.toBeInTheDocument()
})

test('guests get a sign-in note instead of private links and no wallet', () => {
  renderGutter()
  expect(screen.getByText(/Sign in to keep a wishlist/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Wishlist/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Wallet' })).not.toBeInTheDocument()
})

test('signed-in users see counts and their wallet balance', () => {
  renderGutter({ signedIn: true })
  expect(screen.getByRole('link', { name: 'Wishlist, 3 items' })).toHaveAttribute(
    'href',
    '#/wishlist',
  )
  expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '#/cart')
  const wallet = screen.getByRole('region', { name: 'Wallet' })
  expect(within(wallet).getByText('$12.50')).toBeInTheDocument()
  expect(within(wallet).getByRole('link', { name: 'Add funds' })).toHaveAttribute(
    'href',
    '#/wallet',
  )
})

test('browse actions and tags filter the catalog; extra tags expand on demand', async () => {
  const user = userEvent.setup()
  const onBrowse = renderGutter()
  await user.click(screen.getByRole('button', { name: 'Free to play' }))
  expect(onBrowse).toHaveBeenLastCalledWith(1, '', true)
  const tagNav = screen.getByRole('navigation', { name: 'Popular tags' })
  expect(within(tagNav).getAllByRole('listitem')).toHaveLength(8)
  await user.click(screen.getByRole('button', { name: 'Show all 11 tags' }))
  expect(within(tagNav).getAllByRole('listitem')).toHaveLength(11)
  await user.click(screen.getByRole('button', { name: 'Tag 11' }))
  expect(onBrowse).toHaveBeenLastCalledWith(1, '11')
})
