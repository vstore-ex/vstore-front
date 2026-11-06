import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../src/auth/context'
import UserProfilePage from '../src/pages/UserProfilePage/UserProfilePage'

let achievements
const profile = {
  id: 42,
  username: 'reader',
  full_name: 'Reader One',
  role_name: 'Member',
  created_at: '2026-09-09T09:59:39Z',
  avatar: null,
  stats: { games: 3, achievements: 0, wishlist: 2 },
}
const games = {
  'game-a': { id: 'game-a', title: 'Orbit', capsuleImage: '/media/orbit.webp' },
  'game-b': { id: 'game-b', title: 'Comet', capsuleImage: '/media/comet.webp' },
}
vi.mock('../src/hooks/useCatalogResource', () => ({
  default: (resource, key) => ({
    data:
      resource === 'userProfile'
        ? profile
        : resource === 'game'
          ? games[key]
          : resource === 'userAchievements'
            ? achievements
            : [],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}))

const achievement = (id, gameId, unlocked_at) => ({
  id,
  title: 'Achievement ' + id,
  description: 'Description ' + id,
  icon: '/media/a' + id + '.webp',
  game_id: gameId,
  unlocked_at,
})

beforeEach(() => {
  achievements = []
})

function renderProfile(auth = { currentUser: null, isAuthenticated: false, status: 'anonymous' }) {
  return render(
    <AuthContext.Provider value={auth}>
      <UserProfilePage id="42" onSignIn={vi.fn()} />
    </AuthContext.Provider>,
  )
}

test('shows the public profile ID for friend requests', () => {
  renderProfile()
  expect(screen.getByText('ID: 42')).toBeInTheDocument()
})

test('shows identity, member date and profile counters for visitors', () => {
  renderProfile()
  expect(screen.getByRole('heading', { level: 1, name: '@reader' })).toBeInTheDocument()
  expect(screen.getByText('Reader One')).toBeInTheDocument()
  expect(screen.getByText('September 9, 2026')).toBeInTheDocument()
  const summary = screen.getByRole('complementary', { name: 'Profile summary' })
  expect(within(summary).getByText('Games').closest('div')).toHaveTextContent('3')
  expect(within(summary).getByText('Wishlist').closest('div')).toHaveTextContent('2')
  expect(within(summary).queryByText('Currently Online')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in to add friend' })).toBeInTheDocument()
  expect(screen.getByText('No achievements unlocked yet.')).toBeInTheDocument()
  expect(screen.getByText('No recent activity.')).toBeInTheDocument()
})

test('own profile offers editing, status and private links', () => {
  renderProfile({ currentUser: { id: 42 }, isAuthenticated: true, status: 'authenticated' })
  expect(screen.getByRole('link', { name: 'Edit Profile' })).toHaveAttribute('href', '#/account')
  const summary = screen.getByRole('complementary', { name: 'Profile summary' })
  expect(within(summary).getByText('Currently Online')).toBeInTheDocument()
  expect(within(summary).getByRole('link', { name: 'Games' })).toHaveAttribute('href', '#/library')
  expect(within(summary).getByRole('link', { name: 'Wishlist' })).toHaveAttribute(
    'href',
    '#/wishlist',
  )
})

test('showcases achievements and groups recent activity by game, newest first', () => {
  achievements = [
    achievement(3, 'game-b', '2026-11-03T10:00:00Z'),
    achievement(2, 'game-a', '2026-11-02T10:00:00Z'),
    achievement(1, 'game-a', '2026-11-01T10:00:00Z'),
    ...Array.from({ length: 7 }, (_, index) =>
      achievement(10 + index, 'game-a', '2026-10-01T10:00:00Z'),
    ),
  ]
  renderProfile()
  const showcase = screen.getByRole('region', { name: 'Achievement Showcase' })
  expect(within(showcase).getAllByRole('listitem')).toHaveLength(8)
  expect(within(showcase).getByText('+2 more unlocked')).toBeInTheDocument()

  const activity = screen.getByRole('region', { name: 'Recent Activity' })
  const rows = within(activity).getAllByRole('article')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByRole('link', { name: 'Comet' })).toHaveAttribute(
    'href',
    '#/games/game-b',
  )
  expect(rows[0]).toHaveTextContent('1 achievement unlocked')
  expect(within(rows[1]).getByRole('link', { name: 'Orbit' })).toBeInTheDocument()
  expect(rows[1]).toHaveTextContent('9 achievements unlocked')
})
