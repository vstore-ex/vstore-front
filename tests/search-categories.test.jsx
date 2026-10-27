import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import SearchResults from '../src/pages/DiscoverPage/SearchResults'
import { CurrencyContext } from '../src/currency/context'
import { deferred, jsonResponse } from './helpers'

const game = { id: 'game-uuid', title: 'Orbit', price: '12.50', currency: 'USD', developer: 'Orbit Studio' }
const person = { id: 7, username: 'reader', full_name: 'Reader One', role_name: 'user', email: 'private@example.com' }
const review = { id: 5, content_md: '**Great** story', is_positive: true, game_id: 'game-uuid', user_id: 7, created_at: '2026-10-20T12:00:00Z' }
const fixtures = { Games: game, People: person, Reviews: review }
const paths = { Games: 'games', People: 'users', Reviews: 'reviews' }
let reply, calls

beforeEach(() => {
  calls = []
  reply = path => jsonResponse([path === 'games' ? game : path === 'users' ? person : review])
  vi.stubGlobal('fetch', vi.fn((url, options) => {
    const parsed = new URL(url, 'http://localhost')
    const path = parsed.pathname.split('/').at(-1)
    if (!['/api/v1/search/games', '/api/v1/search/users', '/api/v1/search/reviews'].includes(parsed.pathname)) throw new Error('Unexpected request: ' + url)
    calls.push({ path, query: parsed.searchParams.get('q'), ...options })
    return Promise.resolve(reply(path, parsed.searchParams.get('q')))
  }))
})

function Search({ query = 'Orbit', onProductSelect, unavailable = '' }) {
  return <CurrencyContext.Provider value={{ code: 'USD', unavailable }}>
    <SearchResults query={query} onProductSelect={onProductSelect} />
  </CurrencyContext.Provider>
}

test('games remain the default category with prices, links and existing click behavior', async () => {
  const user = userEvent.setup(), select = vi.fn()
  render(<Search onProductSelect={select} />)
  const link = await screen.findByRole('link', { name: /Orbit Studio/ })
  expect(link).toHaveAttribute('href', '#/games/game-uuid')
  expect(link).toHaveTextContent('$12.50')
  expect(screen.getByRole('tab', { name: 'Games' })).toHaveAttribute('aria-selected', 'true')
  expect(calls.map(call => call.path)).toEqual(['games'])
  fireEvent.click(link, { ctrlKey: true })
  expect(select).not.toHaveBeenCalled()
  await user.click(link)
  expect(select).toHaveBeenCalledExactlyOnceWith('game-uuid')
})

test('people show only public identity and link to profiles without leaking email', async () => {
  const user = userEvent.setup()
  render(<Search />)
  await user.click(screen.getByRole('tab', { name: 'People' }))
  const personLink = await screen.findByRole('link', { name: '@reader Reader One user' })
  expect(personLink).toHaveAttribute('href', '#/users/7')
  expect(document.body).not.toHaveTextContent('private@example.com')
  expect(screen.getByRole('tabpanel', { name: 'People' })).toContainElement(personLink)
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  expect(screen.queryByRole('link', { name: /Orbit Studio/ })).not.toBeInTheDocument()
})

test('review snippets are safely formatted and show author, verdict, date and optional game navigation', async () => {
  reply = path => jsonResponse(path === 'reviews' ? [
    { ...review, is_positive: false, content_md: '**Great** story. [bad](javascript:alert(1)) ![track](https://tracker.test/pixel) <script>alert(1)</script>' },
    { id: 6, content_md: 'Without game context', game_id: null },
  ] : [game])
  const user = userEvent.setup()
  render(<Search />)
  await user.click(screen.getByRole('tab', { name: 'Reviews' }))
  const card = await screen.findByRole('article', { name: 'Review #5' })
  expect(within(card).getByRole('heading')).toHaveTextContent('Not recommended')
  expect(within(card).getByText('Great').tagName).toBe('STRONG')
  expect(within(card).getByRole('link', { name: 'User #7' })).toHaveAttribute('href', '#/users/7')
  expect(within(card).getByRole('link', { name: 'View game' })).toHaveAttribute('href', '#/games/game-uuid')
  expect(card.querySelector('time')).toHaveAttribute('dateTime', review.created_at)
  expect(card.querySelector('script, img, a[href^="javascript:"]')).toBeNull()
  expect(within(screen.getByRole('article', { name: 'Review #6' })).queryByRole('link')).not.toBeInTheDocument()
})

test.each(['Games', 'People', 'Reviews'])('%s supports loading, error, retry and empty results', async category => {
  const pending = deferred()
  reply = path => path === paths[category] ? pending.promise : jsonResponse([game])
  const user = userEvent.setup()
  render(<Search />)
  if (category !== 'Games') await user.click(screen.getByRole('tab', { name: category }))
  expect(screen.getByRole('status')).toHaveTextContent('Loading ' + category.toLowerCase() + ' search results...')
  await act(async () => pending.resolve(jsonResponse({ detail: 'Search temporarily unavailable.' }, 503)))
  expect(await screen.findByRole('alert')).toHaveTextContent('Search temporarily unavailable.')
  expect(screen.queryByText(/^No .* found/)).not.toBeInTheDocument()
  reply = () => jsonResponse([])
  await user.click(screen.getByRole('button', { name: 'Retry ' + category.toLowerCase() + ' search results' }))
  expect(await screen.findByRole('status')).toHaveTextContent('No ' + category.toLowerCase() + ' found.')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each(['Games', 'People', 'Reviews'])('%s ignores stale responses and aborts the old query', async category => {
  const pending = deferred()
  const next = category === 'Games' ? { ...game, title: 'New result' }
    : category === 'People' ? { ...person, username: 'new_person' }
      : { ...review, content_md: 'New review result' }
  reply = (path, query) => path === paths[category] && query === 'old'
    ? pending.promise : jsonResponse([query === 'new' ? next : game])
  const user = userEvent.setup()
  const { rerender } = render(<Search query="old" />)
  if (category !== 'Games') await user.click(screen.getByRole('tab', { name: category }))
  const previous = calls.find(call => call.path === paths[category] && call.query === 'old')
  rerender(<Search query="new" />)
  expect(previous.signal.aborted).toBe(true)
  const resultText = category === 'Games' ? 'New result' : category === 'People' ? '@new_person' : 'New review result'
  await screen.findByText(resultText)
  await act(async () => pending.resolve(jsonResponse([fixtures[category]])))
  expect(screen.getByText(resultText)).toBeInTheDocument()
  expect(screen.queryByText(category === 'Games' ? 'Orbit' : category === 'People' ? '@reader' : 'Great')).not.toBeInTheDocument()
})

test('keyboard tabs have roving focus, selected state and correctly labelled panels', async () => {
  const user = userEvent.setup()
  render(<Search />)
  await screen.findByText('Orbit')
  const games = screen.getByRole('tab', { name: 'Games' })
  games.focus()
  await user.keyboard('{ArrowRight}')
  const people = screen.getByRole('tab', { name: 'People' })
  expect(people).toHaveFocus()
  expect(people).toHaveAttribute('aria-selected', 'true')
  expect(games).toHaveAttribute('tabindex', '-1')
  expect(screen.getByRole('tabpanel', { name: 'People' })).toHaveAttribute('id', people.getAttribute('aria-controls'))
  await user.keyboard('{End}')
  expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveFocus()
  await user.keyboard('{ArrowRight}')
  expect(games).toHaveFocus()
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveFocus()
  await user.keyboard('{Home}')
  expect(games).toHaveFocus()
})

test('changing categories or leaving search cancels requests and hides late errors', async () => {
  const pending = deferred()
  reply = path => path === 'games' ? pending.promise : jsonResponse([person])
  const user = userEvent.setup()
  const { unmount } = render(<Search />)
  await user.click(screen.getByRole('tab', { name: 'People' }))
  expect(calls[0].signal.aborted).toBe(true)
  await screen.findByText('@reader')
  await act(async () => pending.reject(new Error('Old game error')))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  const second = deferred()
  reply = () => second.promise
  await user.click(screen.getByRole('tab', { name: 'Reviews' }))
  const signal = calls.at(-1).signal
  unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => second.resolve(jsonResponse([review])))
})

test('people search remains available when game prices cannot be loaded', async () => {
  const user = userEvent.setup()
  render(<Search unavailable="Prices are temporarily unavailable." />)
  expect(screen.getByRole('alert')).toHaveTextContent('Prices are temporarily unavailable.')
  await user.click(screen.getByRole('tab', { name: 'People' }))
  expect(await screen.findByText('@reader')).toBeInTheDocument()
  expect(calls.at(-1).path).toBe('users')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
