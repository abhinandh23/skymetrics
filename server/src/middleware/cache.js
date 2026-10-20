/**
 * Cache successful JSON GET responses by URL.
 * @param {import('../utils/ttlCache.js').TtlCache} cache
 */
export function cacheResponses(cache) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = req.originalUrl;
    const hit = cache.get(key);
    if (hit !== undefined) {
      res.set('X-Cache', 'HIT');
      return res.json(hit);
    }
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) cache.set(key, body);
      res.set('X-Cache', 'MISS');
      return json(body);
    };
    return next();
  };
}
