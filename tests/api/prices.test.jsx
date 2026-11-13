import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { formatMoney } from '../../src/utils/money'
import { getDiscover, getGame, getGames, mapGame, searchGames } from '../../src/api/catalog'
import { getWishlist } from '../../src/api/wishlist'
import { getCart } from '../../src/api/cart'
import { CurrencyContext } from '../../src/currency/context'
import SearchResults from '../../src/pages/DiscoverPage/SearchResults'
import { jsonResponse } from '../helpers'

const game = { id: 'orbit', title: 'Orbit', price: '12.50', currency: 'EUR' }
let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

test.each([
  [false],
  [true],
  [null],
  [undefined],
  [''],
  ['  '],
  [[]],
  [[0]],
  [[12.5]],
  [{}],
  [NaN],
  [Infinity],
  ['unavailable'],
])('does not invent a price for invalid money input %j', (value) => {
  expect(formatMoney(value, 'EUR')).toBe('Price unavailable')
})

test.each([
  ['USD', '$1,234.50'],
  ['EUR', '€1,234.50'],
  ['GBP', '£1,234.50'],
  ['PLN', 'zł 1,234.50'],
  ['KZT', '₸ 1,234.50'],
  ['TRY', '₺ 1,234.50'],
  ['UAH', '₴ 1,234.50'],
  ['JPY', '¥1,234.50'],
])('preserves the server amount and currency for %s', (currency, expected) => {
  expect(formatMoney('1234.50', currency).replaceAll('\u00a0', ' ')).toBe(expected)
})

test('keeps real zero prices, integer JPY, and signed transaction amounts', () => {
  expect(formatMoney(0, 'EUR')).toBe('€0.00')
  expect(formatMoney('0.00', 'JPY')).toBe('¥0')
  expect(formatMoney(1234, 'JPY')).toBe('¥1,234')
  expect(formatMoney('-12.50', 'EUR')).toBe('-€12.50')
  expect(formatMoney(' 12.50 ', 'USD')).toBe('$12.50')
  expect(formatMoney('12.50', null)).toBe('Price unavailable')
  expect(formatMoney('12.50', '$')).toBe('Price unavailable')
})

test.each([[false], [true], [[0]], [[12.5]], [{}], [null], [''], [-1]])(
  'rejects malformed paid-game price %j before formatting',
  (price) => {
    expect(() => mapGame({ ...game, price })).toThrow('invalid game price')
  },
)

test.each([[true], [[20]], [{}], [Infinity]])(
  'does not create a discount from invalid original_price %j',
  (original_price) => {
    const result = mapGame({ ...game, price: '0.50', original_price })
    expect(result.originalPrice).toBe('')
    expect(result.discount).toBe('')
    expect(result.price).toBe('€0.50')
  },
)

test('preserves legitimate discounts and explicitly free games', () => {
  expect(mapGame({ ...game, original_price: '25.00' })).toMatchObject({
    price: '€12.50',
    originalPrice: '€25.00',
    discount: '-50%',
    amount: 12.5,
  })
  expect(mapGame({ ...game, price: 0 })).toMatchObject({ price: '€0.00', amount: 0 })
  expect(mapGame({ ...game, is_free: true, price: null })).toMatchObject({
    price: 'Free',
    amount: 0,
    is_free: true,
  })
})

test('a string is_free flag cannot turn a paid game into a free game', () => {
  expect(mapGame({ ...game, is_free: 'false' })).toMatchObject({
    price: '€12.50',
    amount: 12.5,
    is_free: false,
  })
})

test('a paid price cannot be presented as free and discounts require a paid original price', () => {
  expect(
    mapGame({ ...game, is_free: true, original_price: '25.00', price: '12.50' }),
  ).toMatchObject({
    price: '€12.50',
    originalPrice: '€25.00',
    discount: '-50%',
    is_free: false,
  })
  expect(mapGame({ ...game, is_free: true, original_price: '25.00', price: '0.00' })).toMatchObject(
    {
      price: '€0.00',
      originalPrice: '€25.00',
      discount: '-100%',
      is_free: false,
    },
  )
})

test('discover preserves tag-section configuration while mapping its games', async () => {
  fetchMock.mockResolvedValue(
    jsonResponse({
      featured: [],
      sections: [
        {
          id: 'tag-action',
          title: 'Action games',
          tag_id: 7,
          game_ids: [],
          limit: 8,
          games: [{ ...game, id: 'tagged', tags: [{ id: 7, name: 'Action' }] }],
        },
      ],
      promos: [],
      deals: [],
      free_games: [],
      ranked_columns: [],
      mobile_banner: null,
    }),
  )

  const result = await getDiscover('', undefined, 'EUR')

  expect(result.sections[0]).toMatchObject({
    id: 'tag-action',
    title: 'Action games',
    tag_id: 7,
    limit: 8,
  })
  expect(result.sections[0].games[0].id).toBe('tagged')
})

test.each([
  ['catalog', () => getGames('', undefined, 'EUR'), [{ ...game, price: false }]],
  ['detail', () => getGame('orbit', undefined, 'EUR'), { ...game, price: false }],
  ['discover', () => getDiscover('', undefined, 'EUR'), { featured: [{ ...game, price: false }] }],
  ['search', () => searchGames('orbit', undefined, 'EUR'), [{ ...game, price: false }]],
  ['wishlist', () => getWishlist(), { items: [{ game: { ...game, price: false } }] }],
])(
  'invalid prices reach the existing error state through the %s API',
  async (_label, load, data) => {
    fetchMock.mockResolvedValue(jsonResponse(data))
    await expect(load()).rejects.toThrow('invalid game price')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  },
)

test('cart validation still rejects malformed amounts and accepts a genuine zero', async () => {
  const cart = { items: [], currency: 'EUR', subtotal: '0.00', tax: '0.00', total: '0.00' }
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...cart, total: false }))
  await expect(getCart()).rejects.toThrow('invalid cart')
  fetchMock.mockResolvedValueOnce(jsonResponse(cart))
  await expect(getCart()).resolves.toEqual(cart)
})

test('search shows a retryable error, then recovers with the real EUR price', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([{ ...game, price: false }]))
  const user = userEvent.setup()
  render(
    <CurrencyContext.Provider value={{ code: 'EUR', switching: false }}>
      <SearchResults query="Orbit" />
    </CurrencyContext.Provider>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid game price')
  expect(screen.queryByRole('link', { name: /Orbit/ })).not.toBeInTheDocument()
  expect(screen.queryByText('€0.00')).not.toBeInTheDocument()
  fetchMock.mockResolvedValueOnce(jsonResponse([game]))
  await user.click(screen.getByRole('button', { name: /retry/i }))
  expect(await screen.findByRole('link', { name: /Orbit/ })).toHaveTextContent('€12.50')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
