import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 1,
})

const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') {
    errors.push(message.text())
  }
})
page.on('pageerror', (error) => {
  errors.push(error.message)
})

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'qa-artifacts/registration-page.png', fullPage: true })

await page.getByRole('button', { name: 'Sign in' }).click()
await page.getByRole('button', { name: 'Create a new one!' }).click()
await page.screenshot({ path: 'qa-artifacts/registration-overlay.png' })
await page.getByRole('button', { name: 'CREATE ACCOUNT' }).click()
await page.getByText('Please fix the highlighted fields.').waitFor()

let receivedBody
let receivedContentType
await page.route('http://localhost:8000/api/v1/auth/register', async (route) => {
  const request = route.request()
  receivedBody = JSON.parse(request.postData() || '{}')
  receivedContentType = request.headers()['content-type']

  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Registered from test.' }),
  })
})

await page.getByLabel('ACCOUNT NAME').fill('testuser')
await page.getByLabel('EMAIL').fill('test@example.com')
await page.getByLabel('PASSWORD').fill('secret123')
await page.getByLabel('FULL NAME').fill('Test User')
await page.getByLabel('PHONE').fill('+380501234567')
await page.getByRole('button', { name: 'CREATE ACCOUNT' }).click()
await page.getByText('Registered from test.').waitFor()
await page.screenshot({ path: 'qa-artifacts/registration-success.png' })

await browser.close()

const expected = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'secret123',
  full_name: 'Test User',
  phone: '+380501234567',
}

if (JSON.stringify(receivedBody) !== JSON.stringify(expected)) {
  errors.push(`Unexpected registration body: ${JSON.stringify(receivedBody)}`)
}

if (!receivedContentType?.includes('application/json')) {
  errors.push(`Missing JSON content type: ${receivedContentType}`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
