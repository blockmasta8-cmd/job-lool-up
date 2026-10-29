import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ADZUNA_SUPPORTED, COUNTRY, CURRENCY, tagRemote } from '../server/geo.js'
import handler from '../api/jobs.js'

const job = (location, eligibility = location) => ({ title: 't', company: 'c', location, eligibility })
const call = async query => {
  let status = 200, body
  await handler({ method: 'GET', query }, { setHeader() {}, status(c) { status = c; return this }, json(d) { body = d; return this } })
  return { status, body }
}

test('country codes match between frontend, API and currency table', () => {
  const src = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const map = src.match(/const countryCode[^=]*=\s*\{([^}]*)\}/)[1]
  const frontend = [...map.matchAll(/:\s*'([a-z]{2})'/g)].map(m => m[1]).sort()
  assert.deepEqual(frontend, Object.keys(COUNTRY).sort())
  assert.deepEqual(Object.keys(CURRENCY).sort(), Object.keys(COUNTRY).sort())
})

test('Ireland has no Adzuna index and is not treated as one', () => {
  assert.equal(ADZUNA_SUPPORTED.has('ie'), false)
  for (const code of ADZUNA_SUPPORTED) assert.ok(COUNTRY[code])
})

test('no false country matches', () => {
  assert.equal(tagRemote(job('Indiana, USA'), 'in'), null)
  assert.equal(tagRemote(job('i.e. flexible'), 'ie'), null)
  assert.equal(tagRemote(job('Northern Ireland'), 'ie'), null)
  assert.equal(tagRemote(job('Northern Ireland'), 'gb')?.remoteEligibility, 'country')
  assert.equal(tagRemote(job('Latin America'), 'us'), null)
  assert.equal(tagRemote(job('Join us remotely'), 'us'), null)
  assert.equal(tagRemote(job('Worldwide (excluding US)'), 'us'), null)
  assert.equal(tagRemote(job('Los Angeles, CA'), 'ca'), null)
})

test('remote eligibility is labelled, never stamped with the selected country', () => {
  const ww = tagRemote(job('Worldwide'), 'za')
  assert.equal(ww.remoteEligibility, 'worldwide')
  assert.equal(ww.countryCode, 'remote')
  const za = tagRemote(job('South Africa'), 'za')
  assert.deepEqual([za.remoteEligibility, za.countryCode], ['country', 'za'])
  assert.equal(tagRemote(job('Remote'), null).remoteEligibility, 'unspecified')
})

test('API rejects unsupported countries and lists the supported ones', async () => {
  const r = await call({ country: 'xx' })
  assert.equal(r.status, 400)
  for (const code of Object.keys(COUNTRY)) assert.match(r.body.error, new RegExp(code))
})

test('every advertised country is accepted; Ireland reports Adzuna as unavailable, not as an error', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('network disabled in test') }
  try {
    for (const code of Object.keys(COUNTRY)) {
      const r = await call({ country: code })
      assert.equal(r.status, 200, code)
      const adz = r.body.providers.find(p => p.name === 'Adzuna')
      assert.ok(adz, code)
      if (code === 'ie') {
        assert.equal(adz.supported, false)
        assert.ok(!r.body.errors.some(e => e.startsWith('Adzuna')))
        assert.match(r.body.notice, /no local-listings source/)
      }
    }
  } finally { globalThis.fetch = realFetch }
})
