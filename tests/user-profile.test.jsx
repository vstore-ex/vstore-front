import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import UserProfilePage from '../src/pages/UserProfilePage/UserProfilePage'

vi.mock('../src/hooks/useCatalogResource', () => ({
  default: (resource) => ({
    data:
      resource === 'userProfile'
        ? {
            id: 42,
            username: 'reader',
            full_name: 'Reader One',
            role_name: 'Member',
            created_at: null,
            avatar: null,
            stats: { games: 0, achievements: 0, wishlist: 0 },
          }
        : [],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}))

test('shows the public profile ID for friend requests', () => {
  render(
    <AuthContext.Provider
      value={{ currentUser: null, isAuthenticated: false, status: 'anonymous' }}
    >
      <UserProfilePage id="42" onSignIn={vi.fn()} />
    </AuthContext.Provider>,
  )

  expect(screen.getByText('ID: 42')).toBeInTheDocument()
})
