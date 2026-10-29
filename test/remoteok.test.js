import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/jobs.js'

// Test fixture shaped like the real Remote OK response (legal notice first, mixed-case host, empty location).
// It exists only inside this test; it is never served to users.
const fixture = [
  { last_updated: 1, legal: 'API Terms of Service: link back to Remote OK and mention it as a source.' },
  { id: '1', slug: 'remote-test-role-1', position: 'Test Role', company: 'Fixture Co', location: '', tags: ['dev'], date: '2026-10-29T00:00:00+00:00', url: 'https://remoteOK.com/remote-jobs/remote-test-role-1', apply_url: 'https://remoteOK.com/remote-jobs/remote-test-role-1' },
  { id: '2', slug: 'x', position: 'Off-site Link', company: 'Evil', location: 'Worldwide', url: 'https://evil.example/remote-jobs/x' },
]

const call = async query => {
  let body
  await handler({ method: 'GET', query }, { setHeader() {}, status() { return this }, json(d) { body = d; return this } })
  return body
}

test('Remote OK jobs with a mixed-case host are accepted, normalised and attributed; foreign hosts are rejected', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async url => {
    const u = String(url)
    if (u.startsWith('https://remoteok.com/api')) return new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.startsWith('https://jobicy.com/')) return new Response(JSON.stringify({ jobs: [] }), { status: 200 })
    throw new Error('unexpected fetch ' + u)
  }
  try {
    const r = await call({})
    const jobs = r.jobs.filter(j => j.source === 'Remote OK')
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].url, 'https://remoteok.com/remote-jobs/remote-test-role-1')
    assert.equal(jobs[0].sourceUrl, 'https://remoteok.com/')
    assert.equal(jobs[0].remoteEligibility, 'unspecified')
    assert.equal(r.providers.find(p => p.name === 'Remote OK').returned, 1)
  } finally { globalThis.fetch = realFetch }
})
