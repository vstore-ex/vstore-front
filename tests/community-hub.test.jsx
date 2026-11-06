import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import CommunityHubPage from '../src/pages/CommunityHubPage/CommunityHubPage'
import { AuthContext } from '../src/auth/context'
import { apiRequest } from '../src/api/client'

vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
vi.mock('../src/pages/ProductDetailPage/ProductReviews', () => ({
  default: ({ id }) => <p>Reviews for {id}</p>,
}))
let gameResource, newsResource
vi.mock('../src/hooks/useCatalogResource', () => ({
  default: (kind) => (kind === 'game' ? gameResource : newsResource),
}))

const game = {
  id: 'game-a',
  title: 'Orbit',
  developer: 'Orbit Studio',
  publisher: 'Orbit Studio',
  is_free: false,
  capsuleImage: '/media/capsule.webp',
  heroImage: '/media/hero.webp',
  libraryHero: '/media/library-hero.webp',
}
const discussion = {
  id: 1,
  game_id: 'game-a',
  title: 'Orbit tips',
  content_md: 'A **useful** discussion about [docking](https://example.test).',
  author_id: 7,
  username: 'player',
  thread_id: 101,
  created_at: '2026-10-29T12:00:00Z',
}
const artwork = {
  id: 2,
  game_id: 'game-a',
  title: 'Orbit landscape',
  description_md: 'My artwork',
  image_url: '/media/art.webp',
  author_id: 8,
  username: 'artist',
  thread_id: 201,
  created_at: '2026-10-30T12:00:00Z',
}

beforeEach(() => {
  window.history.replaceState(null, '', '/#/games/game-a/community')
  gameResource = { data: game, loading: false, error: null, retry: vi.fn() }
  newsResource = { data: [], loading: false, error: null, retry: vi.fn() }
  apiRequest.mockReset().mockImplementation(async (path) => {
    if (path === '/community/games/game-a/discussions') return [discussion]
    if (path === '/artworks/game/game-a') return [artwork]
    throw new Error('Unexpected request ' + path)
  })
})

function renderHub() {
  return render(
    <AuthContext.Provider value={{ isAuthenticated: false, currentUser: null }}>
      <CommunityHubPage id="game-a" onSignIn={vi.fn()} />
    </AuthContext.Provider>,
  )
}

test('shows the game header and a mixed activity wall on the All tab', async () => {
  renderHub()
  expect(screen.getByRole('heading', { level: 1, name: 'Orbit' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Store Page' })).toHaveAttribute('href', '#/games/game-a')
  expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  const wall = await screen.findByRole('list', { name: 'Recent community activity' })
  const tiles = within(wall).getAllByRole('listitem')
  // Newest first: the artwork was posted after the discussion.
  expect(tiles[0]).toHaveTextContent('Orbit landscape')
  expect(tiles[1]).toHaveTextContent('Orbit tips')
  expect(tiles[1]).toHaveTextContent('A useful discussion about docking.')
  expect(document.title).toBe('Orbit community · VStore')
})

test('switching tabs keeps the section in the URL and shows that section', async () => {
  const user = userEvent.setup()
  renderHub()
  await screen.findByRole('list', { name: 'Recent community activity' })
  await user.click(screen.getByRole('tab', { name: 'Discussions' }))
  expect(window.location.hash).toBe('#/games/game-a/community?tab=discussions')
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Discussions')
  expect(await screen.findByRole('button', { name: 'Orbit tips' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in to start a discussion' })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Reviews' }))
  expect(screen.getByText('Reviews for game-a')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'All' }))
  expect(window.location.hash).toBe('#/games/game-a/community')
})

test('opens the requested tab from a shared link', async () => {
  window.history.replaceState(null, '', '/#/games/game-a/community?tab=artwork')
  renderHub()
  expect(screen.getByRole('tab', { name: 'Artwork' })).toHaveAttribute('aria-selected', 'true')
  expect(await screen.findByRole('button', { name: 'Orbit landscape' })).toBeInTheDocument()
})

test('shows not found for a missing game', () => {
  gameResource = { data: null, loading: false, error: { status: 404 }, retry: vi.fn() }
  renderHub()
  expect(screen.getByRole('heading', { name: 'Game not found' })).toBeInTheDocument()
  expect(apiRequest).not.toHaveBeenCalled()
})
