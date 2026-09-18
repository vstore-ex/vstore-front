import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = process.env.VSTORE_TEST_URL || 'http://localhost:5173'
const user = { id: 42, username: 'cookie_user', email: 'cookie@example.com', full_name: 'Test User', stats: {} }
let browser
before(async () => { browser = await chromium.launch(); await mkdir('test-results', { recursive: true }) })
after(async () => browser?.close())
async function setup(t, options = {}) {
  const context = await browser.newContext()
  context.setDefaultTimeout(8000)
  t.after(() => context.close())
  const state = { active: !!options.active, expired: false, refreshFails: false, banned: false, calls: [], errors: [] }
  const cookies = () => context.addCookies([{ name: 'access_token', value: 'test-cookie', url: base, httpOnly: true, sameSite: 'Lax' }])
  if (state.active) await cookies()
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', '')
    state.calls.push({ path, method: request.method(), headers: request.headers(), body: request.postData() })
    const reply = (status, json) => route.fulfill({ status, json })
    if (options.handlers?.[path]) return options.handlers[path]({ reply, request, state })
    if (path === '/auth/register/') return reply(201, user)
    if (path === '/login') { state.active = true; await cookies(); return reply(200, { access_token: 'ignored', refresh_token: 'ignored' }) }
    if (path === '/refresh') {
      await new Promise(resolve => setTimeout(resolve, 80))
      if (!state.active || state.refreshFails) return reply(401, { detail: 'refresh expired' })
      state.expired = false; await cookies(); return reply(200, { access_token: 'ignored' })
    }
    if (path === '/logout' || path === '/logout-all') { state.active = false; await context.clearCookies(); return reply(200, {}) }
    if (path === '/users/me' || path === '/users/me/avatar' || path.startsWith('/protected')) {
      if (state.banned) return reply(403, { detail: 'account banned' })
      if (!state.active || state.expired) return reply(401, { detail: 'expired' })
      return reply(200, request.method() === 'PATCH' && path === '/users/me' ? { ...user, ...request.postDataJSON() } : user)
    }
    if (path === '/discover/discover') return reply(200, { featured: null, sections: [], deals: [], promos: [], free_games: [], ranked_columns: [] })
    if (path === '/me/cart' || path === '/wishlists/') return reply(200, { items: [] })
    return reply(200, [])
  })
  const page = await context.newPage()
  page.on('pageerror', error => state.errors.push(error.message))
  await page.goto(base + (options.route || ''))
  await page.getByRole('button', { name: state.active ? 'Sign out' : 'Sign in', exact: true }).waitFor()
  return { page, context, state }
}
async function login(page) {
  if (page.url().includes('/#/login')) await page.locator('.auth-overlay').waitFor()
  if (!await page.locator('.auth-overlay').count()) await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('SIGN IN WITH ACCOUNT NAME').fill(user.username)
  await page.getByLabel('PASSWORD', { exact: true }).fill('Test-password-123')
  await page.locator('.auth-submit').click()
}
async function request(page, paths) {
  return page.evaluate(async paths => {
    const { apiRequest } = await import('/src/api/client.js')
    return Promise.all(paths.map(path => apiRequest(path).then(() => 'ok', error => error.status || error.message)))
  }, paths)
}
test('registration, cookie login, reload, profile and image upload', async t => {
  const { page, state } = await setup(t)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Create a new one!' }).click()
  await page.getByLabel('PUT YOUR EMAIL HERE').fill(user.email)
  await page.getByLabel('CREATE AN ACCOUNT NAME').fill(user.username)
  await page.getByLabel('CREATE A PASSWORD').fill('Test-password-123')
  await page.locator('[name="human"]').check()
  await page.locator('.auth-submit').click()
  await page.getByRole('heading', { name: 'Account created!' }).waitFor()
  await page.getByRole('button', { name: 'LOG IN', exact: true }).click()
  await login(page)
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await page.getByRole('heading', { name: user.username }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: user.username }).waitFor()
  assert.equal(await page.locator('.auth-overlay').count(), 0)
  await page.getByLabel('Full name').fill('Updated Name')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await page.getByText('Profile saved.', { exact: true }).waitFor()
  await page.getByLabel('Avatar', { exact: true }).setInputFiles({ name: 'avatar.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await page.getByText('Avatar saved.', { exact: true }).waitFor()
  assert.ok(state.calls.find(c => c.path === '/users/me/avatar').headers['content-type'].startsWith('multipart/form-data; boundary='))
  assert.ok(state.calls.every(c => !c.headers.authorization))
  assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage).filter(key => /token|authenticated/i.test(key)), session: Object.keys(sessionStorage).filter(key => /token|authenticated/i.test(key)), cookie: document.cookie })), { local: [], session: [], cookie: '' })
  await page.screenshot({ path: 'test-results/auth-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/auth-mobile.png' })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(state.errors, [])
})
test('protected routes preserve destination across login and reload', async t => {
  for (const route of ['account', 'cart', 'orders', 'wishlist']) {
    const { page } = await setup(t)
    await page.goto(base + '/#/' + route)
    await page.waitForURL('**/#/login?next=' + route)
    await page.reload()
    await login(page)
    await page.waitForURL('**/#/' + route)
    await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  }
})
test('simultaneous 401 requests share one refresh and retry once', async t => {
  const { page, state } = await setup(t, { active: true })
  state.expired = true
  assert.deepEqual(await request(page, ['/protected/a', '/protected/b', '/protected/c']), ['ok', 'ok', 'ok'])
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 1)
  assert.equal(state.calls.filter(c => c.path.startsWith('/protected')).length, 6)
  assert.equal(await page.locator('.auth-overlay').count(), 0)
  assert.deepEqual(state.errors, [])
})
test('expired refresh redirects to login without loops', async t => {
  const { page, state } = await setup(t, { active: true, route: '/#/account' })
  state.expired = true; state.refreshFails = true
  assert.deepEqual(await request(page, ['/protected/a', '/protected/b']), [401, 401])
  await page.waitForURL('**/#/login?next=account')
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 1)
  assert.deepEqual(state.errors, [])
})
test('a rejected retry ends the session without another refresh', async t => {
  const { page, state } = await setup(t, { active: true, handlers: { '/protected/no': ({ reply }) => reply(401, { detail: 'rejected' }) } })
  assert.deepEqual(await request(page, ['/protected/no']), [401])
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 1)
  assert.equal(state.calls.filter(c => c.path === '/protected/no').length, 2)
})
test('banned accounts get a dedicated screen without refresh', async t => {
  const { page, state } = await setup(t, { active: true })
  state.banned = true
  assert.deepEqual(await request(page, ['/protected/a']), [403])
  await page.getByRole('heading', { name: 'Account blocked' }).waitFor()
  assert.equal(await page.locator('.auth-overlay').count(), 0)
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 0)
})
test('login 401 stays in the form and never refreshes', async t => {
  const { page, state } = await setup(t, { handlers: { '/login': ({ reply }) => reply(401, { detail: 'incorrect username or password' }) } })
  const initial = state.calls.filter(c => c.path === '/refresh').length
  await login(page)
  await page.getByText('incorrect username or password', { exact: true }).waitFor()
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, initial)
})
test('registration duplicates appear beside editable username and email', async t => {
  const { page } = await setup(t, { handlers: { '/auth/register/': ({ reply }) => reply(400, { detail: 'user already exists' }) } })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Create a new one!' }).click()
  await page.getByLabel('PUT YOUR EMAIL HERE').fill(user.email)
  await page.getByLabel('CREATE AN ACCOUNT NAME').fill(user.username)
  await page.getByLabel('CREATE A PASSWORD').fill('Test-password-123')
  await page.locator('[name="human"]').check()
  await page.locator('.auth-submit').click()
  await page.locator('#username[aria-invalid="true"]').waitFor()
  assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true')
})
test('logout broadcasts immediately and all-devices logout uses real endpoint', async t => {
  for (const all of [false, true]) {
    const { page, context, state } = await setup(t, { active: true, route: '/#/account' })
    const other = await context.newPage(); await other.goto(base + '/#/account')
    await other.getByRole('heading', { name: user.username }).waitFor()
    const signedOut = page.waitForResponse(response => response.url().endsWith(all ? '/logout-all' : '/logout'))
    await page.getByRole('button', { name: all ? 'Sign out of all devices' : 'Sign out', exact: true }).click()
    await other.waitForURL('**/#/login?next=account')
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
    await page.waitForURL('**/#/discover')
    await signedOut
    assert.ok(state.calls.some(c => c.path === (all ? '/logout-all' : '/logout')))
    await page.reload()
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  }
})

test('initial restoration never flashes signed-out controls and refreshes expired cookies', async t => {
  const { page, state } = await setup(t, { active: true })
  const releases = []
  await page.route('**/api/v1/users/me', route => new Promise(resolve => {
    releases.push(async () => { await route.fulfill({ status: 200, json: user }); resolve() })
  }))
  await page.reload()
  await page.getByText('Loading account...', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).count(), 0)
  await page.waitForTimeout(100)
  await Promise.all(releases.map(release => release()))
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  await page.unroute('**/api/v1/users/me')
  state.expired = true
  await page.reload()
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 1)
})
test('ordinary forbidden responses do not ban or refresh the session', async t => {
  const { page, state } = await setup(t, { active: true, handlers: { '/protected/denied': ({ reply }) => reply(403, { detail: 'permission denied' }) } })
  assert.deepEqual(await request(page, ['/protected/denied']), [403])
  assert.equal(state.calls.filter(c => c.path === '/refresh').length, 0)
  await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
})
test('failed server logout still clears every tab and offers retry', async t => {
  const { page, context } = await setup(t, { active: true, handlers: { '/logout': ({ reply }) => reply(503, { detail: 'Service unavailable' }) } })
  const other = await context.newPage(); await other.goto(base)
  await other.getByRole('button', { name: 'Sign out', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Retry sign out', exact: true }).waitFor()
  await other.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Sign out', exact: true }).count(), 0)
})
