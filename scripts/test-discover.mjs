import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const seed = JSON.parse(await readFile(new URL('./fixtures/discover.json', import.meta.url), 'utf8'))
const resolveAssets = value => typeof value === 'string' && value.startsWith('asset:')
  ? '/src/assets/' + value.slice(6) : Array.isArray(value) ? value.map(resolveAssets)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveAssets(item)])) : value
const select = ids => (ids || []).map(id => seed.games.find(game => game.id === id))
const layout = resolveAssets({
  featured: seed.games.find(game => game.id === seed.discover.featured_game_id),
  sections: seed.discover.sections.map(section => ({ ...section, games: select(section.game_ids) })),
  promos: seed.discover.promos, deals: select(seed.discover.deals_game_ids), free_games: select(seed.discover.free_games_game_ids),
  ranked_columns: seed.discover.ranked_columns.map(column => ({ ...column, games: select(column.game_ids) })),
  mobile_banner: seed.discover.mobile_banner,
})
const server = await createServer({ server: { host: '127.0.0.1', port: 5191 }, cacheDir: 'node_modules/.vite-discover-test' })
await server.listen()
const browser = await chromium.launch()
const base = 'http://127.0.0.1:' + server.httpServer.address().port
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  let mode = 'filled'
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname + url.search)
    if (url.pathname.endsWith('/discover/discover')) {
      if (mode === 'error') return route.fulfill({ status: 503, json: { detail: 'Unavailable' } })
      return route.fulfill({ json: mode === 'empty' ? {} : layout })
    }
    if (url.pathname.endsWith('/taxonomy/tags')) return route.fulfill({ json: [{ id: 1, name: 'Action' }] })
    if (url.pathname.endsWith('/games/')) {
      const skip = Number(url.searchParams.get('skip')) || 0
      const games = mode === 'empty' || url.searchParams.has('tag_id') ? [] : seed.games.slice(skip, skip + Number(url.searchParams.get('limit')))
      return route.fulfill({ json: resolveAssets(games) })
    }
    return route.fulfill({ status: 401, json: { detail: 'Guest' } })
  })
  await page.goto(base)
  await page.getByRole('heading', { name: 'Discover Something New' }).waitFor()
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const image of document.images) image.loading = 'eager'
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})))
  })
  assert.equal(await page.locator('.promo-card').count(), 3)
  assert.equal(await page.locator('.showcase-column').count(), 3)
  assert.equal(await page.locator('.free-game-card').count(), 3)
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 6005)
  assert.equal(await page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)), true)
  await mkdir('qa-artifacts', { recursive: true })
  await page.screenshot({ path: 'qa-artifacts/discover-desktop.png', fullPage: true })
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'qa-artifacts/discover-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'View More', exact: true }).click()
  await page.getByRole('heading', { name: 'Free games', exact: true }).waitFor()
  assert.equal(await page.locator('.product-card').count(), 3)
  await page.getByRole('link', { name: 'Back to Discover', exact: true }).click()
  await page.getByRole('button', { name: 'All games', exact: true }).click()
  await page.getByRole('heading', { name: 'All games', exact: true }).waitFor()
  assert.equal(await page.locator('.product-card').count(), 24)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.store-pagination [aria-current]')?.textContent === '2')
  await page.getByRole('button', { name: 'Action', exact: true }).click()
  await page.getByText('No games match this tag.', { exact: true }).waitFor()
  assert.ok(requests.some(url => url.includes('skip=24') && url.includes('limit=25')))
  assert.ok(requests.some(url => url.includes('tag_id=1')))
  mode = 'empty'
  await page.goto(base + '/#/discover')
  await page.reload()
  await page.getByText('No games available on this page.', { exact: true }).waitFor()
  assert.equal(await page.locator('.product-card').count(), 0)
  assert.equal(await page.locator('.featured-game').count(), 0)
  mode = 'error'
  await page.reload()
  await page.getByRole('button', { name: 'Retry Discover', exact: true }).waitFor()
  mode = 'filled'
  await page.getByRole('button', { name: 'Retry Discover', exact: true }).click()
  await page.getByRole('heading', { name: 'Discover Something New' }).waitFor()
  await page.getByRole('button', { name: 'Learn more', exact: true }).click()
  await page.waitForURL('**/#/products/4')
  assert.deepEqual(errors, [])
  console.log('PASS: Figma geometry, assets, responsive widths, API pagination/tags, free games, product navigation, empty data and retry.')
} finally {
  await browser.close()
  await server.close()
}
