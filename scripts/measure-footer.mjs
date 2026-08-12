import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 320 },
  deviceScaleFactor: 1,
})

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })

const boxes = await page.evaluate(() => {
  const box = (selector) => {
    const element = document.querySelector(selector)
    const rect = element.getBoundingClientRect()

    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    }
  }

  return {
    footer: box('.store-footer'),
    content: box('.footer-content'),
    social: box('.social-links'),
    legal: box('.legal-copy'),
    nav: box('.footer-nav'),
    backToTop: box('.back-to-top'),
    logo: box('.footer-logo'),
  }
})

await browser.close()

console.log(JSON.stringify(boxes, null, 2))
