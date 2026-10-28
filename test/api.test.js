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
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
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
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
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

test('job search API accepts additional global launch countries', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    if (url.hostname.includes('arbeitnow')) return {
      ok: true, status: 200, json: async () => ({ data: [{
        slug: 'global-market-data-engineer-123',
        title: 'Global Market Data Engineer',
        company_name: 'Northstar',
        location: 'Berlin, Germany',
        remote: false,
        url: 'https://www.arbeitnow.com/view/global-market-data-engineer-123',
        tags: ['Data', 'Engineering'],
        job_types: ['full_time'],
        created_at: 1792800000,
      }] }),
    }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const res = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'de', query: 'engineer' } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.errors.length, 0)
    assert.ok(res.body.providers.some((provider) => provider.country === 'de'))
    assert.ok(res.body.jobs.some((job) => job.source === 'Arbeitnow' && job.countryCode === 'de'))
    assert.ok(res.body.jobs.some((job) => job.url === 'https://www.arbeitnow.com/view/global-market-data-engineer-123'))
  } finally {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  }
})

test('Arbeitnow market feed is normalized, filtered, and cached between searches', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  let feedCalls = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.hostname === 'www.arbeitnow.co.uk') {
      feedCalls += 1
      return { ok: true, status: 200, json: async () => ({ data: [
        {
          slug: 'customer-support-specialist-001', title: 'Customer Support Specialist',
          company_name: 'Northstar UK', location: 'London, United Kingdom', remote: false,
          url: 'https://www.arbeitnow.co.uk/view/customer-support-specialist-001',
          tags: ['Support'], job_types: ['full_time'], created_at: 1792800000,
        },
        {
          slug: 'data-engineer-002', title: 'Data Engineer',
          company_name: 'Northstar UK', location: 'London, United Kingdom', remote: true,
          url: 'https://www.arbeitnow.co.uk/view/data-engineer-002',
          tags: ['Data'], job_types: ['full_time'], created_at: 1792800000,
        },
      ] }) }
    }
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const first = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'gb', query: 'customer' } }, first)
    assert.equal(first.statusCode, 200)
    assert.equal(first.body.errors.length, 0)
    assert.equal(first.body.jobs.length, 1)
    assert.equal(first.body.jobs[0].source, 'Arbeitnow')
    assert.equal(first.body.jobs[0].company, 'Northstar UK')
    assert.equal(first.body.jobs[0].postedAt, '2026-10-24T00:00:00.000Z')

    const second = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'gb', query: 'engineer' } }, second)
    assert.equal(second.statusCode, 200)
    assert.equal(second.body.errors.length, 0)
    assert.equal(second.body.jobs.length, 1)
    assert.equal(second.body.jobs[0].title, 'Data Engineer')
    assert.equal(feedCalls, 1, 'country feed should be fetched once and reused across different searches')
  } finally {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  }
})

test('all 27 public country filters are accepted', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.hostname.includes('arbeitnow')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const countries = ['us', 'za', 'gb', 'ca', 'au', 'nz', 'de', 'fr', 'nl', 'ie', 'sg', 'jp', 'kr', 'ae', 'ch', 'se', 'no', 'dk', 'in', 'es', 'it', 'br', 'mx', 'at', 'be', 'pl', 'pt']
    for (const country of countries) {
      const res = createResponse()
      await jobsHandler({ method: 'GET', query: { country, query: `country-smoke-${country}` } }, res)
      assert.equal(res.statusCode, 200, `country filter ${country} should be accepted`)
      assert.equal(res.body.errors.length, 0, `country filter ${country} should complete without provider errors`)
    }
  } finally {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  }
})

test('Adzuna does not run until commercial licence confirmation is explicit', async () => {
  const originalFetch = globalThis.fetch
  const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  process.env.ADZUNA_APP_ID = 'test-app-id'
  process.env.ADZUNA_APP_KEY = 'test-app-key'
  process.env.ADZUNA_COMMERCIAL_LICENSE_CONFIRMED = 'false'
  delete process.env.USAJOBS_API_KEY
  delete process.env.USAJOBS_USER_AGENT
  let adzunaCalls = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    if (url.hostname === 'api.adzuna.com') {
      adzunaCalls += 1
      return { ok: true, status: 200, json: async () => ({ results: [{
        id: 101, title: 'Licensed Test Engineer', created: '2026-10-25T00:00:00Z',
        redirect_url: 'https://jobs.example.test/101', company: { display_name: 'Example Co' },
        location: { display_name: 'New York' }, category: { label: 'Engineering' },
      }] }) }
    }
    if (url.hostname === 'jobicy.com') return { ok: true, status: 200, json: async () => ({ jobs: [] }) }
    if (url.hostname === 'remoteok.com') return { ok: true, status: 200, json: async () => [] }
    throw new Error('Unexpected upstream in test: ' + url.hostname)
  }
  try {
    const denied = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'us', query: 'licence-gate-denied' } }, denied)
    assert.equal(denied.statusCode, 200)
    assert.equal(adzunaCalls, 0)
    assert.equal(denied.body.providers.some((provider) => provider.name === 'Adzuna' && provider.configured === false), true)

    process.env.ADZUNA_COMMERCIAL_LICENSE_CONFIRMED = 'true'
    const allowed = createResponse()
    await jobsHandler({ method: 'GET', query: { country: 'us', query: 'licence-gate-enabled' } }, allowed)
    assert.equal(allowed.statusCode, 200)
    assert.equal(adzunaCalls, 1)
    assert.equal(allowed.body.providers.some((provider) => provider.name === 'Adzuna' && provider.configured === true), true)
    assert.ok(allowed.body.jobs.some((job) => job.source === 'Adzuna' && job.url === 'https://jobs.example.test/101'))
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
    const envKeys = ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'ADZUNA_COMMERCIAL_LICENSE_CONFIRMED', 'USAJOBS_API_KEY', 'USAJOBS_USER_AGENT']
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
