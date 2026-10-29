// In-memory feed cache. Jobicy asks for at most one sync per hour, so keyless feeds are fetched once per TTL
// per upstream URL, concurrent callers share one request, and a stale copy (up to staleMs) covers upstream errors.
const store = new Map()
const inflight = new Map()

export async function cachedJson(key, load, { ttlMs = 60 * 60 * 1000, staleMs = 6 * 60 * 60 * 1000 } = {}) {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && now - hit.at < ttlMs) return hit.data
  if (inflight.has(key)) return inflight.get(key)
  const request = (async () => {
    try {
      const data = await load()
      store.set(key, { at: Date.now(), data })
      return data
    } catch (error) {
      if (hit && now - hit.at < staleMs) return hit.data
      throw error
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, request)
  return request
}

export const clearFeedCache = () => { store.clear(); inflight.clear() }
