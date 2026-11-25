/**
 * Namespaced chrome.storage.local cache.
 *
 * One item per (namespace, key) so writing one entry never rewrites the rest.
 * storage.local has a 10MB total budget and no per-item cap, which is why
 * every cache, outbox and offline list lives here rather than in sync.
 */

const PREFIX = "c.";

function itemKey(ns, key) {
  return `${PREFIX}${ns}.${key}`;
}

export function cacheFor(ns) {
  return {
    /**
     * @returns {Promise<{value:any, age:number}|null>} age in ms
     */
    async read(key) {
      const k = itemKey(ns, key);
      const got = await chrome.storage.local.get(k);
      const entry = got[k];
      if (!entry || typeof entry.t !== "number") return null;
      return { value: entry.v, age: Date.now() - entry.t };
    },

    async write(key, value) {
      await chrome.storage.local.set({ [itemKey(ns, key)]: { v: value, t: Date.now() } });
    },

    async drop(key) {
      await chrome.storage.local.remove(itemKey(ns, key));
    },

    /**
     * Stale-while-revalidate.
     *
     * Calls onValue(value, meta) up to twice: immediately with cached data if
     * any exists, then again with fresh data if a fetch happened. That is what
     * lets a tile paint before any network or identity call.
     *
     * meta = { stale: boolean, age: number|null, fromCache: boolean }
     *
     * Fetch failures are reported through onError but never thrown, so a dead
     * network shows stale data with a marker instead of an error shard.
     *
     * @returns {Promise<{served:'cache'|'fresh'|'none', error?:Error}>}
     */
    async swr(key, { ttl = 0, fetch: doFetch, onValue, onError, signal } = {}) {
      const cached = await this.read(key);
      let stale = true;

      if (cached) {
        stale = cached.age > ttl;
        if (onValue) onValue(cached.value, { stale, age: cached.age, fromCache: true });
      }

      if (!stale) return { served: "cache" };
      if (signal && signal.aborted) return { served: cached ? "cache" : "none" };

      try {
        const fresh = await doFetch({ signal });
        if (signal && signal.aborted) return { served: cached ? "cache" : "none" };
        await this.write(key, fresh);
        if (onValue) onValue(fresh, { stale: false, age: 0, fromCache: false });
        return { served: "fresh" };
      } catch (error) {
        if (signal && signal.aborted) return { served: cached ? "cache" : "none" };
        if (onError) onError(error, { hadCache: Boolean(cached) });
        // Deliberately not rethrown: a failed refresh must not blank a tile
        // that already has usable cached data.
        return { served: cached ? "cache" : "none", error };
      }
    },
  };
}
