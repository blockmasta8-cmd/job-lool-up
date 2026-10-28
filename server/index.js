import http from 'node:http'
import { URL } from 'node:url'
import jobsHandler from '../api/jobs.js'
import healthHandler from '../api/health.js'
const PORT = Number(process.env.API_PORT || 8787)
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const query = Object.fromEntries(url.searchParams.entries())
  const response = {
    setHeader: (name, value) => res.setHeader(name, value),
    status(code) { res.statusCode = code; return this },
    json(data) { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); return this },
  }
  try {
    if (url.pathname === '/api/health') return healthHandler({ method: req.method, query }, response)
    if (url.pathname === '/api/jobs') return await jobsHandler({ method: req.method, query }, response)
    res.statusCode = 404
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Not found' }))
  } catch (error) {
    console.error('API request failed:', error)
    if (!res.headersSent) res.statusCode = 500
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'Internal API error' }))
  }
})
server.listen(PORT, '0.0.0.0', () => console.log(`Job-Lool-Up API listening on ${PORT}`))
