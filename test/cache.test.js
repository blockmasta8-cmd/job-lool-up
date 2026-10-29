import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/jobs.js'
import { cachedJson, clearFeedCache } from '../server/cache.js'

const call = async query => {
  let body
  await handler({ method: 'GET', query }, { setHeader() {}, status() { return this }, json(d) { body = d; return this } })
  return body
}

test('keyless feeds are fetched once per hour across many searches (Jobicy limit), with query applied locally', async () => {
  clearFeedCache()
  const realFetch = globalThis.fetch
  const hits = { jobicy: 0, remoteok: 0 }
  globalThis.fetch = async url => {
    const u = String(url)
    if (u.startsWith('https://jobicy.com/')) { hits.jobicy++; return new Response(JSON.stringify({ jobs: [{ id: 1, jobTitle: 'Fixture Nurse', companyName: 'Fixture', jobGeo: 'Anywhere', url: 'https://jobicy.com/jobs/1-fixture' }] }), { status: 200 }) }
    if (u.startsWith('https://remoteok.com/')) { hits.remoteok++; return new Response(JSON.stringify([{ legal: 'x' }]), { status: 200 }) }
    throw new Error('unexpected fetch ' + u)
  }
  try {
    const a = await call({ query: 'nurse' })
    await call({ query: 'engineer' })
    await call({ query: 'nurse', country: 'za' })
    assert.equal(a.jobs.filter(j => j.source === 'Jobicy').length, 1)
    assert.equal(hits.jobicy, 1, 'jobicy anywhere feed fetched once')
    assert.equal(hits.remoteok, 1, 'remote ok fetched once')
    assert.equal((await call({ query: 'engineer' })).jobs.length, 0, 'query filter applied locally')
  } finally { globalThis.fetch = realFetch; clearFeedCache() }
})

test('cache serves a stale copy on upstream failure, never caches errors, and shares in-flight requests', async () => {
  clearFeedCache()
  let n = 0
  const ok = () => { n++; return Promise.resolve({ v: n }) }
  assert.deepEqual(await cachedJson('k', ok, { ttlMs: 0, staleMs: 1000 }), { v: 1 })
  assert.deepEqual(await cachedJson('k', () => Promise.reject(new Error('down')), { ttlMs: 0, staleMs: 1000 }), { v: 1 })
  await assert.rejects(cachedJson('fresh', () => Promise.reject(new Error('down'))), /down/)
  const [x, y] = await Promise.all([cachedJson('s', ok), cachedJson('s', ok)])
  assert.equal(x, y)
  assert.equal(n, 2)
})
