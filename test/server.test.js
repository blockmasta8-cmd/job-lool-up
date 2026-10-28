import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const builtIndex = resolve(root, 'dist', 'index.html')

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') {
        probe.close()
        reject(new Error('Could not allocate a test port'))
        return
      }
      probe.close((error) => error ? reject(error) : resolvePort(address.port))
    })
  })
}

test('single Node service serves the built frontend and health API', { skip: !existsSync(builtIndex) && 'Run npm run build to enable the production smoke test' }, async (t) => {
  const port = await availablePort()
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ADZUNA_APP_ID: '',
      ADZUNA_APP_KEY: '',
      ADZUNA_COMMERCIAL_LICENSE_CONFIRMED: 'false',
      USAJOBS_API_KEY: '',
      USAJOBS_USER_AGENT: '',
    },
    stdio: 'ignore',
  })
  t.after(() => {
    if (!child.killed) child.kill('SIGTERM')
  })

  const base = 'http://127.0.0.1:' + port
  let health
  let lastError
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      health = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })
      break
    } catch (error) {
      lastError = error
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    }
  }
  assert.ok(health, 'server should start successfully: ' + String(lastError))
  assert.equal(health.status, 200)
  const healthBody = await health.json()
  assert.equal(healthBody.status, 'ok')
  assert.equal(healthBody.providers.adzuna, false)
  assert.equal(healthBody.providers.usajobs, false)

  const page = await fetch(base + '/')
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type') || '', /text\/html/)
  const html = await page.text()
  assert.match(html, /Job-Lool-Up/)

  const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
  assert.ok(scriptPath, 'built HTML should reference a JavaScript bundle')
  const bundle = await fetch(new URL(scriptPath, base))
  assert.equal(bundle.status, 200)
  assert.match(bundle.headers.get('content-type') || '', /javascript/)
})
