import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { URL } from 'node:url'
import jobsHandler from '../api/jobs.js'
import healthHandler from '../api/health.js'

const ROOT_DIR = resolve(fileURLToPath(new URL('../', import.meta.url)))
const DIST_DIR = resolve(ROOT_DIR, 'dist')
const PORT = Number(process.env.PORT || process.env.API_PORT || 8787)
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function serveFrontend(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, HEAD')
    res.end()
    return true
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    res.statusCode = 400
    res.end('Bad request')
    return true
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath
  let filePath = resolve(DIST_DIR, relativePath)
  if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + sep)) {
    res.statusCode = 403
    res.end('Forbidden')
    return true
  }

  let body
  try {
    body = await readFile(filePath)
  } catch {
    // Client-side routes should load the app shell; missing assets should remain 404s.
    if (extname(decodedPath)) return false
    try {
      filePath = resolve(DIST_DIR, 'index.html')
      body = await readFile(filePath)
    } catch {
      return false
    }
  }

  const contentType = MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('Content-Type', contentType)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (decodedPath.startsWith('/assets/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } else {
    res.setHeader('Cache-Control', 'no-cache')
  }
  res.end(req.method === 'HEAD' ? undefined : body)
  return true
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost:' + PORT)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (requestUrl.pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'GET, OPTIONS')
      res.statusCode = 204
      return res.end()
    }
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Allow', 'GET, OPTIONS')
      res.statusCode = 405
      return res.end(JSON.stringify({ error: 'Method not allowed' }))
    }

    const query = Object.fromEntries(requestUrl.searchParams.entries())
    const response = {
      setHeader: (name, value) => res.setHeader(name, value),
      status(code) {
        res.statusCode = code
        return this
      },
      json(data) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(data))
        return this
      },
    }

    try {
      if (requestUrl.pathname === '/api/health') return healthHandler({ method: req.method, query }, response)
      if (requestUrl.pathname === '/api/jobs') return await jobsHandler({ method: req.method, query }, response)
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.end(JSON.stringify({ error: 'Not found' }))
    } catch (error) {
      console.error('API request failed:', error)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'Internal API error' }))
      }
      if (!res.writableEnded) return res.end()
      return
    }
  }

  try {
    const served = await serveFrontend(req, res, requestUrl.pathname)
    if (served) return
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: 'Not found' }))
  } catch (error) {
    console.error('Frontend request failed:', error)
    if (!res.headersSent) res.statusCode = 500
    if (!res.writableEnded) res.end('Internal server error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('Job-Lool-Up listening on port ' + PORT)
})
