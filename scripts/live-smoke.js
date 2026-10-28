import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const countries = (() => {
  const arg = process.argv.find(value => value.startsWith('--country='))
  const value = arg ? arg.slice('--country='.length) : 'us,za,de'
  return [...new Set(value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean))]
})()
const allowed = new Set(['us', 'za', 'gb', 'ca', 'au', 'nz', 'de', 'fr', 'nl', 'ie', 'sg', 'jp', 'kr', 'ae', 'ch', 'se', 'no', 'dk', 'in', 'es', 'it', 'br', 'mx', 'at', 'be', 'pl', 'pt'])
if (!countries.length || countries.some(country => !allowed.has(country))) {
  console.error('Invalid --country value. Use comma-separated supported codes, e.g. --country=us,za,de')
  process.exit(2)
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a local port'))
        return
      }
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

const port = await freePort()
const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port) },
  stdio: 'inherit',
})
const base = 'http://127.0.0.1:' + port
let failed = false

try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error('API server exited before becoming ready')
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        const health = await response.json()
        console.log('\nHealth:', JSON.stringify(health))
        ready = true
        break
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (!ready) throw new Error('Local API did not become ready within 15 seconds')

  for (const country of countries) {
    console.log('\n--- Live smoke test:', country.toUpperCase(), '---')
    const response = await fetch(base + '/api/jobs?' + new URLSearchParams({ country, limit: '10' }), {
      signal: AbortSignal.timeout(35000),
    })
    if (!response.ok) {
      failed = true
      console.error('API returned HTTP', response.status)
      continue
    }
    const data = await response.json()
    if (!Array.isArray(data.jobs) || !Array.isArray(data.providers) || !Array.isArray(data.errors)) {
      failed = true
      console.error('API response did not match the expected schema')
      continue
    }
    const uniqueKeys = new Set()
    let duplicateCount = 0
    let invalidLinks = 0
    for (const job of data.jobs) {
      const key = [job.title, job.company, job.location].map(v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|')
      if (uniqueKeys.has(key)) duplicateCount += 1
      uniqueKeys.add(key)
      if (typeof job.url !== 'string' || !job.url.startsWith('https://')) invalidLinks += 1
    }
    console.log(JSON.stringify({
      country,
      totalListings: data.total,
      sources: data.providers.map(p => ({ name: p.name, configured: p.configured, returned: p.returned, error: p.error || null })),
      duplicateCandidates: duplicateCount,
      invalidHttpsLinks: invalidLinks,
      providerErrors: data.errors,
      sampleListings: data.jobs.slice(0, 3).map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
        url: job.url,
      })),
    }, null, 2))
    if (invalidLinks > 0 || data.errors.length > 0) failed = true
  }
} catch (error) {
  failed = true
  console.error('Live smoke test failed:', error.message)
} finally {
  child.kill('SIGTERM')
  await new Promise(resolve => {
    if (child.exitCode !== null) return resolve()
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 3000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

if (failed) {
  console.error('\nLive smoke test found failures. Review provider errors above; third-party APIs may be unavailable or credentials may be missing.')
  process.exitCode = 1
} else {
  console.log('\nLive smoke test passed for:', countries.join(', '))
}
