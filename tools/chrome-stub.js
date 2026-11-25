/**
 * DEV ONLY - not shipped behaviour, not loaded by newtab.html.
 *
 * Minimal in-memory stand-in for chrome.storage so tools/preview.html can run
 * the real app outside an extension context (headless screenshots, quick
 * layout checks). Deliberately a classic script, not a module, so it executes
 * before the deferred module graph touches chrome.storage at import time.
 */
(function () {
  if (globalThis.chrome && globalThis.chrome.storage) return;

  const mem = { sync: Object.create(null), local: Object.create(null) };
  const listeners = [];

  function keyList(keys, name) {
    if (keys == null) return Object.keys(mem[name]);
    if (typeof keys === "string") return [keys];
    if (Array.isArray(keys)) return keys;
    return Object.keys(keys);
  }

  function area(name) {
    return {
      async get(keys) {
        const out = {};
        for (const k of keyList(keys, name)) {
          if (k in mem[name]) out[k] = mem[name][k];
        }
        return out;
      },
      async set(obj) {
        const changes = {};
        for (const [k, v] of Object.entries(obj)) {
          changes[k] = { oldValue: mem[name][k], newValue: v };
          mem[name][k] = v;
        }
        for (const fn of listeners) fn(changes, name);
      },
      async remove(keys) {
        const changes = {};
        for (const k of keyList(keys, name)) {
          changes[k] = { oldValue: mem[name][k], newValue: undefined };
          delete mem[name][k];
        }
        for (const fn of listeners) fn(changes, name);
      },
      async clear() {
        mem[name] = Object.create(null);
      },
      async getBytesInUse() {
        return JSON.stringify(mem[name]).length;
      },
    };
  }

  globalThis.chrome = {
    storage: {
      sync: area("sync"),
      local: area("local"),
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };

  globalThis.__PB_PREVIEW__ = true;
})();
