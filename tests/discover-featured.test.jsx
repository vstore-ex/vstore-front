import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import DiscoverPage from '../src/pages/DiscoverPage/DiscoverPage'
import useCatalogResource from '../src/hooks/useCatalogResource'
vi.mock('../src/hooks/useCatalogResource', () => ({ default: vi.fn() }))
const game = { id: '1', title: 'Featured game', price: '$10.00', tags: [], media: [] }

test('featured carousel accepts the single game returned by the catalog API and deduplicates section games', () => {
  useCatalogResource.mockImplementation((type) => ({
    loading: false,
    data:
      type === 'discover'
        ? {
            featured: game,
            sections: [
              { title: 'Recommended', games: [game, { ...game, id: '2', title: 'Another game' }] },
            ],
            promos: [],
            deals: [],
            free_games: [],
            ranked_columns: [],
          }
        : type === 'game'
          ? game
          : [],
  }))
  const { container } = render(<DiscoverPage />)
  expect(screen.getByRole('region', { name: 'Featured & Recommended' })).toBeInTheDocument()
  expect(container.querySelectorAll('.store-featured__slide')).toHaveLength(2)
})
