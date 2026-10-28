import assert from 'node:assert/strict'
import test from 'node:test'
import jobsHandler from '../api/jobs.js'

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
  }
}


test('job search API caches identical public searches briefly', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  let upstreamCalls = 0
  globalThis.fetch = async (input) => {
    upstreamCalls += 1
    const url = new URL(String(input))
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const query = { country: 'za', query: 'cache-test-unique', limit: '7' }
    const first = createResponse()
    await jobsHandler({ method: 'GET', query }, first)
    assert.equal(first.statusCode, 200)
    assert.equal(upstreamCalls, 2)
    const second = createResponse()
    await jobsHandler({ method: 'GET', query }, second)
    assert.equal(second.statusCode, 200)
    assert.deepEqual(second.body, first.body)
    assert.equal(upstreamCalls, 2, 'the second identical request should use the cache')
  } finally {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  }
})

test('job search API does not cache provider failures', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  let upstreamCalls = 0
  let shouldFail = true
  globalThis.fetch = async (input) => {
    upstreamCalls += 1
    const url = new URL(String(input))
    if (shouldFail) throw new Error('Temporary provider outage')
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const query = { country: 'za', query: 'failure-cache-test-unique', limit: '6' }
    const failed = createResponse()
    await jobsHandler({ method: 'GET', query }, failed)
    assert.equal(failed.statusCode, 200)
    assert.equal(failed.body.errors.length, 2)
    assert.equal(upstreamCalls, 2)

    shouldFail = false
    const recovered = createResponse()
    await jobsHandler({ method: 'GET', query }, recovered)
    assert.equal(recovered.statusCode, 200)
    assert.equal(recovered.body.errors.length, 0)
    assert.equal(upstreamCalls, 4, 'the retry should call providers again after a failure')
  } finally {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  }
})

test('job search API validates requests and uses real source records', async (t) => {
  await t.test('rejects methods other than GET', async () => {
    const res = createResponse()
    await jobsHandler({ method: 'POST', query: {} }, res)
    assert.equal(res.statusCode, 405)
    assert.deepEqual(res.body, { error: 'Method not allowed' })
  })

  await t.test('rejects unsupported country codes', async () => {
    const res = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'xx' } }, res)
    assert.equal(res.statusCode, 400)
    assert.match(res.body.error, /Supported launch countries/)
  })

  await t.test('normalizes source records, preserves original links, and deduplicates repeated jobs', async () => {
    const originalFetch = globalThis.fetch
    const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
    for (const key of envKeys) delete process.env[key]

    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      if (url.hostname === 'jobicy.com') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jobs: [{
              id: 'jc-101',
              jobTitle: 'Software Engineer',
              companyName: 'Acme Inc',
              jobGeo: 'United States',
              jobType: ['Full-time'],
              jobIndustry: ['Software'],
              url: 'https://jobicy.com/jobs/101',
              pubDate: '2026-10-25T00:00:00Z',
            }],
          }),
        }
      }
      if (url.hostname === 'remoteok.com') {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'ro-101',
              position: 'Software Engineer',
              company: 'Acme Inc',
              location: 'United States',
              url: 'https://remoteok.com/remote-jobs/101',
              date: '2026-10-25T00:00:00Z',
              tags: ['software'],
            },
            {
              id: 'ro-102',
              position: 'Data Engineer',
              company: 'Northstar',
              location: 'United States',
              url: 'https://remoteok.com/remote-jobs/102',
              date: '2026-10-24T00:00:00Z',
              tags: ['data'],
            },
          ],
        }
      }
      throw new Error('Unexpected upstream in test: ' + url.hostname)
    }

    try {
      const res = createResponse()
      await jobsHandler({ method: 'GET', query: { country: 'us', query: 'engineer', limit: '15' } }, res)
      assert.equal(res.statusCode, 200)
      assert.equal(res.body.total, 2)
      assert.equal(res.body.jobs.length, 2)
      assert.deepEqual(new Set(res.body.jobs.map((job) => job.source)), new Set(['Jobicy', 'Remote OK']))
      assert.ok(res.body.jobs.every((job) => job.url.startsWith('https://')))
      assert.ok(res.body.jobs.some((job) => job.url === 'https://jobicy.com/jobs/101'))
      assert.ok(res.body.jobs.some((job) => job.url === 'https://remoteok.com/remote-jobs/102'))
      assert.equal(res.body.configured, true)
    } finally {
      globalThis.fetch = originalFetch
      for (const key of envKeys) {
        if (originalEnv[key] === undefined) delete process.env[key]
        else process.env[key] = originalEnv[key]
      }
    }
  })
})
