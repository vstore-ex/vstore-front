import { createServer } from 'vite'
import { spawn } from 'node:child_process'

const [source, ...files] = process.argv.slice(2)
process.env.VITE_DATA_SOURCE = source
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests-' + source,
  server: { host: '127.0.0.1', port: 5180, strictPort: false },
})
try {
  await server.listen()
  const port = server.httpServer.address().port
  const child = spawn(process.execPath, ['--test', ...files], {
    stdio: 'inherit', env: { ...process.env, VSTORE_TEST_URL: 'http://127.0.0.1:' + port },
  })
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolve(code ?? 1))
  })
} finally { await server.close() }
