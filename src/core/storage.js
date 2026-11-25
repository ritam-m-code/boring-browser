/**
 * Namespaced chrome.storage.sync access.
 *
 * Each namespace lives in exactly ONE sync item ("t.<ns>"), which keeps us well
 * under MAX_ITEMS and makes a write one operation rather than N.
 *
 * Hard rule for callers: config only, never anything on a timer.
 * storage.sync allows 120 writes/minute and 1800/hour. Caches and anything
 * tick-driven belong in cache.js (storage.local) instead.
 */

const AREA = "sync";
const PREFIX = "t.";

const memo = new Map();   // key -> stored object, kept fresh by onChanged
let listening = false;
const watchers = new Map(); // key -> Set<fn>

function ensureListener() {
  if (listening) return;
  listening = true;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== AREA) return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      memo.set(key, newValue ?? {});
      const subs = watchers.get(key);
      if (subs) for (const fn of subs) {
        try { fn(newValue ?? {}); } catch (e) { console.error("[storage] watcher threw", e); }
      }
    }
  });
}

async function readRaw(key) {
  if (memo.has(key)) return memo.get(key);
  const got = await chrome.storage.sync.get(key);
  const value = got[key] ?? {};
  memo.set(key, value);
  return value;
}

/**
 * @param {string} ns          namespace, normally the tile id
 * @param {object} defaults    resolved defaults (from the tile's settings schema)
 */
export function namespaced(ns, defaults = {}) {
  ensureListener();
  const key = PREFIX + ns;

  return {
    /** get() -> whole object merged over defaults; get(k) -> one value */
    async get(field) {
      const stored = await readRaw(key);
      const merged = { ...defaults, ...stored };
      return field === undefined ? merged : merged[field];
    },

    /** Shallow merge. Only the named fields change. */
    async set(patch) {
      const stored = await readRaw(key);
      const next = { ...stored, ...patch };
      memo.set(key, next);
      await chrome.storage.sync.set({ [key]: next });
      return next;
    },

    async reset() {
      memo.set(key, {});
      await chrome.storage.sync.remove(key);
    },

    /** Fires with the merged object whenever this namespace changes. */
    onChange(fn, { signal } = {}) {
      if (!watchers.has(key)) watchers.set(key, new Set());
      const wrapped = (stored) => fn({ ...defaults, ...stored });
      watchers.get(key).add(wrapped);
      if (signal) {
        signal.addEventListener("abort", () => {
          const set = watchers.get(key);
          if (set) set.delete(wrapped);
        }, { once: true });
      }
      return () => {
        const set = watchers.get(key);
        if (set) set.delete(wrapped);
      };
    },

    /** Diagnostics for the Phase 4 sync-quota check. */
    async bytes() {
      return chrome.storage.sync.getBytesInUse(key);
    },
  };
}

/** Core's own namespace, for layout and other non-tile config. */
export const coreStore = namespaced("__core", { order: null, hidden: {} });
