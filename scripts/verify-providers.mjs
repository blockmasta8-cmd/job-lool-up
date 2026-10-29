// Live provider check. Run where outbound internet is available; it prints counts only, never secrets.
// Usage: node --env-file-if-exists=.env scripts/verify-providers.mjs
import handler from '../api/jobs.js'
import { COUNTRY } from '../server/geo.js'
const call = query => new Promise(resolve => {
  let status = 200
  handler({ method: 'GET', query }, { setHeader() {}, status(c) { status = c; return this }, json: d => resolve({ status, ...d }) })
})
for (const code of ['', ...Object.keys(COUNTRY)]) {
  const r = await call({ ...(code ? { country: code } : {}), limit: '10' })
  const by = {}
  for (const j of r.jobs || []) by[j.source] = (by[j.source] || 0) + 1
  const kinds = { local: 0, worldwide: 0, countryListed: 0, unspecified: 0 }
  for (const j of r.jobs || []) j.workLocation === 'in-country' ? kinds.local++ : j.remoteEligibility === 'worldwide' ? kinds.worldwide++ : j.remoteEligibility === 'country' ? kinds.countryListed++ : kinds.unspecified++
  console.log((code || 'ALL').padEnd(4), 'HTTP', r.status, 'jobs', r.total ?? 0, JSON.stringify(by), JSON.stringify(kinds))
  for (const p of r.providers || []) console.log('     ', p.name.padEnd(10), p.country.padEnd(7), p.supported === false ? 'unsupported' : p.configured ? 'configured' : 'no credentials', 'returned', p.returned, p.error ? 'ERROR ' + p.error : '')
}
