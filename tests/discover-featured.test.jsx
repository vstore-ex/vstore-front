import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import DiscoverPage from '../src/pages/DiscoverPage/DiscoverPage'
import { CurrencyContext } from '../src/currency/context'
import { apiRequest } from '../src/api/client'
vi.mock('../src/api/client', async (original) => ({ ...(await original()), apiRequest: vi.fn() }))
const game = (id, title) => ({ id, title, currency: 'USD', price: '10.00', tags: [], media: [] })
const featured = [game(1, 'Admin first'), game(2, 'Admin second')]

function setup(layout) {
  apiRequest.mockImplementation(async (path) => {
    if (path.startsWith('/discover/discover?')) return layout
    if (path === '/taxonomy/tags' || path.startsWith('/games/?')) return []
    if (/^\/games\/\d+\?/.test(path)) return game(Number(path.match(/\d+/)[0]), 'Game details')
    throw new Error('Unexpected request: ' + path)
  })
  return render(
    <CurrencyContext.Provider value={{ code: 'USD' }}>
      <DiscoverPage />
    </CurrencyContext.Provider>,
  )
}

test('admin featured list survives the real API adapter in order and deduplicates section games', async () => {
  const { container } = setup({
    featured,
    sections: [{ title: 'Recommended', games: [featured[1], game(3, 'Section game')] }],
  })
  await screen.findByRole('region', { name: 'Featured & Recommended' })
  await waitFor(() => expect(container.querySelectorAll('.store-featured__slide')).toHaveLength(3))
  expect(
    Array.from(container.querySelectorAll('.store-featured__slide'), (node) =>
      node.getAttribute('aria-label'),
    ),
  ).toEqual(['Admin first', 'Admin second', 'Section game'])
})

test('featured games render even without any sections', async () => {
  setup({ featured, sections: [] })
  await screen.findByRole('region', { name: 'Featured & Recommended' })
  expect(screen.getByRole('article', { name: 'Admin first' })).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Admin second' })).toBeInTheDocument()
})

test('an empty featured list falls back to the catalog when no sections are configured', async () => {
  setup({ featured: [], sections: [] })
  await screen.findByRole('heading', { name: 'All games' })
  expect(screen.queryByRole('region', { name: 'Featured & Recommended' })).not.toBeInTheDocument()
})
