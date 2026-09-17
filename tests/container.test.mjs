import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const exec = promisify(execFile)
async function docker(...args) {
  const { stdout } = await exec('docker', args, { timeout: 600000, maxBuffer: 10 * 1024 * 1024 })
  return stdout.trim()
}

test('production container serves assets, SPA fallback and healthcheck', { timeout: 660000 }, async () => {
  const tag = `frontend-app:smoke-${process.pid}`
  let container
  try {
    await docker('build', '-t', tag, '.')
    container = await docker('run', '--rm', '-d', '-p', '127.0.0.1::8080', tag)
    const inspect = JSON.parse(await docker('inspect', container))[0]
    const port = inspect.NetworkSettings.Ports['8080/tcp'][0].HostPort
    const base = `http://127.0.0.1:${port}`
    let healthy = false
    for (let attempt = 0; attempt < 45; attempt++) {
      const state = JSON.parse(await docker('inspect', container))[0].State
      if (state.Health.Status === 'healthy') { healthy = true; break }
      if (!state.Running || state.Health.Status === 'unhealthy') break
      await delay(1000)
    }
    assert.ok(healthy, 'container must become healthy')
    const get = path => fetch(base + path, { signal: AbortSignal.timeout(5000) })
    const health = await get('/healthz')
    assert.equal(health.status, 200)
    assert.equal(await health.text(), 'healthy\n')
    const home = await get('/')
    assert.equal(home.status, 200)
    const html = await home.text()
    assert.match(html, /<div id="root"><\/div>/)
    const deepLink = await get('/products/1')
    assert.equal(deepLink.status, 200)
    assert.equal(await deepLink.text(), html)
    assert.equal(deepLink.headers.get('cache-control'), 'no-cache, no-store, must-revalidate')
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1])
    assert.ok(assets.some(asset => asset.endsWith('.js')))
    assert.ok(assets.some(asset => asset.endsWith('.css')))
    for (const path of assets) {
      const response = await get(path)
      assert.equal(response.status, 200, path)
      assert.doesNotMatch(response.headers.get('content-type'), /text\/html/)
      assert.match(response.headers.get('cache-control'), /immutable/)
      assert.ok((await response.arrayBuffer()).byteLength > 0)
    }
    assert.equal((await get('/assets/missing.js')).status, 404)
    assert.equal((await get('/.env')).status, 403)
  } catch (error) {
    if (container) console.error(await docker('logs', container).catch(() => 'Unable to read container logs'))
    throw error
  } finally {
    if (container) await docker('stop', container)
    await docker('image', 'rm', tag).catch(() => {})
  }
})
