/**
 * Minimal in-memory TTL cache with a size cap (oldest entry evicted first).
 * Good enough for a single API instance; a shared cache (e.g. Redis) would replace it at scale.
 */
export class TtlCache {
  /** @param {{ ttlMs: number, maxEntries?: number, now?: () => number }} options */
  constructor({ ttlMs, maxEntries = 500, now = Date.now }) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    /** @type {Map<string, { value: unknown, expiresAt: number }>} */
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.ttlMs <= 0) return;
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}
