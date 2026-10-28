const COUNTRY = {
  us: 'United States', za: 'South Africa', gb: 'United Kingdom', ca: 'Canada',
  au: 'Australia', nz: 'New Zealand', de: 'Germany', fr: 'France', nl: 'Netherlands',
  ie: 'Ireland', sg: 'Singapore', jp: 'Japan', kr: 'South Korea', ae: 'United Arab Emirates',
  ch: 'Switzerland', se: 'Sweden', no: 'Norway', dk: 'Denmark', in: 'India',
  es: 'Spain', it: 'Italy', br: 'Brazil', mx: 'Mexico', at: 'Austria', be: 'Belgium',
  pl: 'Poland', pt: 'Portugal'
}
const allowed = new Set(Object.keys(COUNTRY))
const adzunaCountries = new Set(['us', 'za', 'gb', 'ca', 'au', 'nz', 'de', 'fr', 'nl', 'ie', 'sg', 'in', 'es', 'it', 'br', 'mx', 'at', 'be', 'pl'])
const CACHE_TTL_MS = 90_000
const responseCache = new Map()
const clean = (v, n = 120) => String(v || '').trim().slice(0, n)
const salary = (a, b, currency = '') => a == null && b == null ? null : `${currency} ${[a, b].filter(v => v != null).map(v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })).join('–')}`.trim()
function matchesText(job, query, location) {
  const text = [job.title, job.company, job.location, job.category, ...(job.tags || [])].join(' ').toLowerCase()
  return (!query || query.toLowerCase().split(/\s+/).every(word => text.includes(word))) && (!location || job.location.toLowerCase().includes(location.toLowerCase()))
}
function matchesCountry(job, country) {
  const geo = (job.location + ' ' + (job.eligibility || '')).toLowerCase()
  const aliases = {
    us: /united states|\\busa\\b|\\bu\\.s\\.\\b|america/i,
    za: /south africa|\\bza\\b/i,
    gb: /united kingdom|\\buk\\b|britain|england|scotland|wales/i,
    ae: /united arab emirates|\\buae\\b|dubai|abu dhabi/i,
    kr: /south korea|republic of korea/i,
    nl: /netherlands|holland/i,
  }
  const name = COUNTRY[country]
  if (!name) return /worldwide|anywhere|global/i.test(geo)
  const matcher = aliases[country] || new RegExp(name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'i')
  return matcher.test(geo) || /worldwide|anywhere|global/i.test(geo)
}
async function searchJobicy({ query, location, country, limit }) {
  const p = new URLSearchParams({ count: String(Math.min(100, Math.max(20, limit * 4))) })
  if (query) p.set('tag', query)
  if (country === 'us') p.set('geo', 'usa')
  if (country === 'za') p.set('geo', 'anywhere')
  const r = await fetch(`https://jobicy.com/api/jobs?${p}`, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json' } })
  if (!r.ok) throw Error(`Jobicy HTTP ${r.status}`)
  const data = await r.json()
  const jobs = (data.jobs || []).map(x => {
    const url = x.url || '', title = clean(x.jobTitle || x.title, 180), postedAt = x.pubDate || x.date || x.jobPosted || null
    if (!title || !url.startsWith('https://jobicy.com/')) return null
    const geo = clean(x.jobGeo || x.location) || 'Remote / eligibility not specified'
    return { id: `jobicy-${clean(x.id, 100)}`, title, company: clean(x.companyName || x.company) || 'Employer not listed', location: geo, country: geo, countryCode: country || 'remote', type: clean(Array.isArray(x.jobType) ? x.jobType.join(', ') : x.jobType) || 'Remote', category: clean(Array.isArray(x.jobIndustry) ? x.jobIndustry.join(', ') : x.jobIndustry) || 'General', salary: salary(x.annualSalaryMin || x.salaryMin, x.annualSalaryMax || x.salaryMax, x.salaryCurrency || ''), postedAt, url, source: 'Jobicy', sourceUrl: 'https://jobicy.com/', tags: Array.isArray(x.jobIndustry) ? x.jobIndustry : [], eligibility: clean(x.jobGeo) }
  }).filter(Boolean).filter(j => matchesText(j, query, location) && (!country || matchesCountry(j, country)))
  return { configured: true, jobs: jobs.slice(0, limit) }
}
async function searchRemoteOK({ query, location, country, limit }) {
  const r = await fetch('https://remoteok.com/api', { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json', 'User-Agent': 'Job-Lool-Up/0.1 (job discovery; source attribution enabled)' } })
  if (!r.ok) throw Error(`Remote OK HTTP ${r.status}`)
  const data = await r.json()
  const jobs = (Array.isArray(data) ? data : []).filter(x => x && x.id && x.position).map(x => {
    const url = x.url || (x.slug ? `https://remoteok.com/remote-jobs/${x.slug}` : '')
    if (!url.startsWith('https://remoteok.com/')) return null
    const geo = clean(x.location) || 'Remote / eligibility not specified'
    return { id: `remoteok-${clean(x.id, 100)}`, title: clean(x.position, 180), company: clean(x.company) || 'Employer not listed', location: geo, country: geo, countryCode: country || 'remote', type: 'Remote', category: clean(Array.isArray(x.tags) ? x.tags.join(', ') : '') || 'General', salary: salary(x.salary_min, x.salary_max, x.salary_currency || 'USD'), postedAt: x.date || null, url, source: 'Remote OK', sourceUrl: 'https://remoteok.com/', tags: Array.isArray(x.tags) ? x.tags : [], eligibility: clean(x.location) }
  }).filter(Boolean).filter(j => matchesText(j, query, location) && (!country || matchesCountry(j, country)))
  return { configured: true, jobs: jobs.slice(0, limit) }
}
function adzunaJob(x, country) {
  const url = x.redirect_url || '', title = clean(x.title, 180), postedAt = x.created || null
  if (!title || !/^https?:\/\//i.test(url)) return null
  if (postedAt && Number.isFinite(Date.parse(postedAt)) && Date.parse(postedAt) < Date.now() - 45 * 86400000) return null
  return { id: `adzuna-${country}-${clean(x.id, 100)}`, title, company: clean(x.company?.display_name) || 'Employer not listed', location: clean(x.location?.display_name) || COUNTRY[country], country: COUNTRY[country], countryCode: country, type: x.contract_time === 'full_time' ? 'Full-time' : x.contract_time === 'part_time' ? 'Part-time' : 'Not specified', category: clean(x.category?.label) || 'General', salary: salary(x.salary_min, x.salary_max, x.salary_currency || (country === 'za' ? 'ZAR' : 'USD')), postedAt, url, source: 'Adzuna', sourceUrl: country === 'za' ? 'https://www.adzuna.co.za/' : 'https://www.adzuna.com/' }
}
async function searchAdzuna({ country, query, location, limit }) {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env
  if (!adzunaCountries.has(country) || !id || !key) return { configured: false, jobs: [] }
  const p = new URLSearchParams({ app_id: id, app_key: key, results_per_page: String(limit), 'content-type': 'application/json' })
  if (query) p.set('what', query)
  if (location) p.set('where', location)
  const r = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${p}`, { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw Error(`Adzuna HTTP ${r.status}`)
  const data = await r.json()
  return { configured: true, jobs: (data.results || []).map(x => adzunaJob(x, country)).filter(Boolean) }
}
async function searchUSA({ query, location, limit }) {
  const { USAJOBS_API_KEY: key, USAJOBS_USER_AGENT: agent } = process.env
  if (!key || !agent) return { configured: false, jobs: [] }
  const p = new URLSearchParams({ ResultsPerPage: String(Math.min(limit, 50)), Fields: 'Min', WhoMayApply: 'Public' })
  if (query) p.set('Keyword', query)
  if (location) p.set('LocationName', location)
  const r = await fetch(`https://data.usajobs.gov/api/Search?${p}`, { headers: { Host: 'data.usajobs.gov', 'User-Agent': agent, 'Authorization-Key': key, accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw Error(`USAJOBS HTTP ${r.status}`)
  const data = await r.json()
  const jobs = (data.SearchResult?.SearchResultItems || []).map(row => {
    const x = row.MatchedObjectDescriptor || {}, url = x.PositionURI || x.ApplyURI?.[0] || '', title = clean(x.PositionTitle, 180), end = x.PositionEndDate || x.ApplicationCloseDate
    if (!title || !url.startsWith('https://') || (end && Date.parse(end) < Date.now())) return null
    const pay = x.PositionRemuneration?.[0]
    return { id: `usajobs-${clean(row.MatchedObjectId || x.PositionID, 100)}`, title, company: clean(x.OrganizationName || x.DepartmentName) || 'U.S. federal agency', location: clean(x.PositionLocationDisplay) || 'United States', country: 'United States', countryCode: 'us', type: clean(x.PositionSchedule?.map(y => y.Name).filter(Boolean).join(', ')) || 'Not specified', category: clean(x.JobCategory?.map(y => y.Name).filter(Boolean).join(', ')) || 'Federal government', salary: salary(pay?.MinimumRange, pay?.MaximumRange, 'USD'), postedAt: x.PublicationStartDate || x.PositionStartDate || null, url, source: 'USAJOBS', sourceUrl: 'https://www.usajobs.gov/' }
  }).filter(Boolean)
  return { configured: true, jobs }
}
function dedupe(jobs) {
  const seen = new Set()
  return jobs.filter(j => {
    const key = [j.title, j.company, j.location].map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const countryParam = clean(req.query?.country, 2).toLowerCase()
  const countries = countryParam ? [countryParam] : ['us', 'za']
  if (countries.some(c => !allowed.has(c))) return res.status(400).json({ error: 'Unsupported country code.' })
  const query = clean(req.query?.query, 100), location = clean(req.query?.location, 100), limit = Math.max(1, Math.min(30, Number(req.query?.limit) || 15))
  const cacheKey = JSON.stringify([countries, query.toLowerCase(), location.toLowerCase(), limit])
  const cached = responseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return res.status(200).json(cached.payload)
  if (cached) responseCache.delete(cacheKey)
  const providers = [], jobs = [], errors = []
  for (const country of countries) {
    const tasks = [searchAdzuna({ country, query, location, limit }).then(x => ({ name: 'Adzuna', country, ...x })).catch(e => ({ name: 'Adzuna', country, configured: true, jobs: [], error: e.message }))]
    if (country === 'us') tasks.push(searchUSA({ query, location, limit }).then(x => ({ name: 'USAJOBS', country, ...x })).catch(e => ({ name: 'USAJOBS', country, configured: true, jobs: [], error: e.message })))
    for (const x of await Promise.all(tasks)) {
      providers.push({ name: x.name, country, configured: x.configured, returned: x.jobs.length, ...(x.error ? { error: x.error } : {}) })
      if (x.error) errors.push(`${x.name} (${country}): ${x.error}`)
      jobs.push(...x.jobs)
    }
  }
  const globalTasks = [
    searchJobicy({ query, location, country: countryParam || null, limit }).then(x => ({ name: 'Jobicy', country: countryParam || 'global', ...x })).catch(e => ({ name: 'Jobicy', country: countryParam || 'global', configured: true, jobs: [], error: e.message })),
    searchRemoteOK({ query, location, country: countryParam || null, limit }).then(x => ({ name: 'Remote OK', country: countryParam || 'global', ...x })).catch(e => ({ name: 'Remote OK', country: countryParam || 'global', configured: true, jobs: [], error: e.message })),
  ]
  for (const x of await Promise.all(globalTasks)) {
    providers.push({ name: x.name, country: x.country, configured: x.configured, returned: x.jobs.length, ...(x.error ? { error: x.error } : {}) })
    if (x.error) errors.push(`${x.name}: ${x.error}`)
    jobs.push(...x.jobs)
  }
  const result = dedupe(jobs).sort((a, b) => Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0)).slice(0, limit * countries.length + limit)
  const payload = { jobs: result, total: result.length, providers, errors, configured: providers.some(p => p.configured), message: result.length ? null : 'No current listings matched. Try a broader search.' }
  // Do not cache partial/error responses; allow a quick retry after provider recovery.
  if (errors.length === 0) responseCache.set(cacheKey, { payload, expiresAt: Date.now() + CACHE_TTL_MS })
  if (responseCache.size > 250) {
    const now = Date.now()
    for (const [key, value] of responseCache) if (value.expiresAt <= now || responseCache.size > 200) responseCache.delete(key)
  }
  return res.status(200).json(payload)
}
