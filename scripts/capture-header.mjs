import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 200 },
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
await page.screenshot({
  path: 'qa-artifacts/implementation-footer.png',
  clip: { x: 0, y: 0, width: 1440, height: 270 },
})

await browser.close()

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
