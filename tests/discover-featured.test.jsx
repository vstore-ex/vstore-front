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

test('admin featured list renders only admin-selected featured games in order', async () => {
  const { container } = setup({
    featured: [featured[0], featured[1], featured[1]],
    sections: [{ title: 'Recommended', games: [featured[1], game(3, 'Section game')] }],
  })
  await screen.findByRole('region', { name: 'Featured & Recommended' })
  await waitFor(() => expect(container.querySelectorAll('.store-featured__slide')).toHaveLength(2))
  expect(
    Array.from(container.querySelectorAll('.store-featured__slide'), (node) =>
      node.getAttribute('aria-label'),
    ),
  ).toEqual(['Admin first', 'Admin second'])
})

test('featured games render even without any sections', async () => {
  setup({ featured, sections: [] })
  await screen.findByRole('region', { name: 'Featured & Recommended' })
  expect(screen.getByRole('article', { name: 'Admin first' })).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Admin second' })).toBeInTheDocument()
})

test('an empty featured list omits the carousel even when sections exist', async () => {
  setup({
    featured: [],
    sections: [{ title: 'Recommended', games: [game(3, 'Section game')] }],
  })
  await screen.findByRole('tab', { name: 'Recommended' })
  expect(screen.queryByRole('region', { name: 'Featured & Recommended' })).not.toBeInTheDocument()
})
