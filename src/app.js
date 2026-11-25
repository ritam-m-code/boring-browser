/**
 * Boot.
 *
 * Responsibilities, in order:
 *   1. paint the generated collage (no network, no storage - instant)
 *   2. create every grid cell from cached geometry
 *   3. import, validate and mount each tile INSIDE ITS OWN try/catch
 *   4. register declared cadences with the single scheduler
 *
 * Nothing here may throw in a way that stops the loop. A broken tile costs
 * one shard, never the page.
 */

import registry from "./tiles/registry.js";
import { collageSVG, seedForDate, bleedText } from "./core/art.js";
import { buildCells, rememberGeometry } from "./core/layout.js";
import { createScheduler } from "./core/scheduler.js";
import { namespaced, coreStore } from "./core/storage.js";
import { cacheFor } from "./core/cache.js";
import { renderTileError, clearTileError, makeBreaker } from "./core/errors.js";
import { createToast } from "./core/toast.js";

/** Single source of "now" so the midnight and date logic is testable. */
const now = () => new Date();

const VALID_KINDS = new Set(["text", "url", "number", "toggle", "select", "list"]);

function validate(desc, id) {
  if (!desc || typeof desc !== "object") {
    throw new Error("module has no default export");
  }
  if (desc.id !== id) {
    throw new Error(`descriptor id "${desc.id}" does not match registry id "${id}"`);
  }
  if (typeof desc.mount !== "function") {
    throw new Error("descriptor.mount is not a function");
  }
  for (const [key, field] of Object.entries(desc.settings || {})) {
    if (!field || !VALID_KINDS.has(field.kind)) {
      throw new Error(`setting "${key}" has unknown kind "${field && field.kind}"`);
    }
  }
  return desc;
}

function resolveDefaults(settings) {
  const out = {};
  for (const [key, field] of Object.entries(settings || {})) {
    out[key] = field.default;
  }
  return out;
}

function adoptStyles(styles) {
  if (!styles) return;
  const sheets = Array.isArray(styles) ? styles : [styles];
  for (const sheet of sheets) {
    if (sheet && !document.adoptedStyleSheets.includes(sheet)) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
  }
}

async function main() {
  const artEl = document.getElementById("art");
  const gridEl = document.getElementById("grid");
  const toast = createToast(document.getElementById("toast"));

  // 1. collage first: deterministic, synchronous, zero I/O
  const today = now();
  artEl.innerHTML = collageSVG(seedForDate(today), { date: today });

  // Themes can key off the hour. P3R uses hour 0 for the Dark Hour, where the
  // whole palette turns green - a pure token swap, no regeneration.
  const bleedEl = document.getElementById("bleed");
  const setHour = (d) => {
    document.documentElement.dataset.hour = String(d.getHours());
    if (bleedEl) bleedEl.textContent = bleedText(d) || "";
  };
  setHour(today);

  const daySeed = seedForDate(today);
  const scheduler = createScheduler({ now });

  // 2. cells up front from cached geometry
  const { order, hidden } = await coreStore.get();
  const cells = await buildCells(gridEl, registry, { daySeed, order, hidden });

  // 3. mount each tile in isolation
  const descriptors = new Map();

  await Promise.all(
    registry.map(async (entry) => {
      const parts = cells.get(entry.id);
      if (!parts) return;   // hidden by config

      const controller = new AbortController();
      const breaker = makeBreaker(3);
      let desc = null;
      let snapshot = {};
      let handle = null;

      const retry = () => {
        controller.abort();
        window.location.reload();
      };

      const safeUpdate = async (reason) => {
        if (!desc || typeof desc.update !== "function") return;
        if (breaker.open) return;
        try {
          await desc.update(parts.body, ctx, reason);
          breaker.pass();
        } catch (error) {
          if (breaker.fail()) {
            // Stop ticking a tile that fails every time, or it spins the CPU
            // of a page opened dozens of times a day.
            if (handle) handle.cancel();
            renderTileError(parts, { id: entry.id, error, onRetry: retry });
          } else {
            console.error(`[tile:${entry.id}] update failed (${reason})`, error);
          }
        }
      };

      const ctx = {
        id: entry.id,
        now,
        toast,
        signal: controller.signal,
        get settings() { return snapshot; },
        get online() { return navigator.onLine; },
        log: (...args) => console.log(`[tile:${entry.id}]`, ...args),
        refresh: () => safeUpdate("manual"),
        schedule: {
          every: (ms, fn) =>
            scheduler.subscribe({ every: ms }, fn, { label: entry.id, signal: controller.signal }),
          at: (date, fn) => {
            const delay = Math.max(0, date.getTime() - Date.now());
            const t = setTimeout(fn, delay);
            controller.signal.addEventListener("abort", () => clearTimeout(t), { once: true });
            return { cancel: () => clearTimeout(t) };
          },
        },
      };

      try {
        const mod = await entry.load();
        desc = validate(mod.default, entry.id);

        adoptStyles(desc.styles);
        descriptors.set(entry.id, desc);

        // Reconcile the placeholder chrome with what the descriptor actually says.
        parts.setTitle(desc.title || entry.id);
        if (desc.span) parts.setSpan(desc.span.cols || 1, desc.span.rows || 1);
        if (typeof desc.tilt === "number") parts.setTilt(desc.tilt);

        const defaults = resolveDefaults(desc.settings);
        const store = namespaced(entry.id, defaults);
        snapshot = await store.get();

        ctx.storage = store;
        ctx.cache = cacheFor(entry.id);
        ctx.seed = parts.seed;

        store.onChange((next) => {
          snapshot = next;
          safeUpdate("settings");
        }, { signal: controller.signal });

        clearTileError(parts, { title: desc.title || entry.id });
        await desc.mount(parts.body, ctx);

        if (desc.tick) {
          handle = scheduler.subscribe(desc.tick, (reason) => safeUpdate(reason), {
            label: entry.id,
            signal: controller.signal,
          });
        }
      } catch (error) {
        renderTileError(parts, { id: entry.id, error, onRetry: retry });
      }
    })
  );

  // 4. remember what the descriptors told us, so the NEXT open lays out
  //    correctly before any tile code runs
  await rememberGeometry(cells, descriptors);

  // The hour drives the Dark Hour swap; a tab left open overnight must cross
  // into it without a reload. "wake" covers a laptop resuming past midnight.
  scheduler.subscribe(["minute", "wake"], () => setHour(now()), { label: "hour" });

  // Regenerate the field when the calendar day turns over, so a tab left open
  // overnight shows tomorrow's art and tonight's moon rather than yesterday's.
  scheduler.subscribe("midnight", () => {
    const d = now();
    artEl.innerHTML = collageSVG(seedForDate(d), { date: d });
  }, { label: "collage" });

  scheduler.start();

  // Last-resort net. Attribution is best-effort; the point is that nothing
  // reaches the user as a silent blank.
  window.addEventListener("error", (e) => {
    console.error("[app] uncaught", e.error || e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[app] unhandled rejection", e.reason);
  });
}

main().catch((e) => {
  console.error("[app] boot failed", e);
  const grid = document.getElementById("grid");
  if (grid && !grid.children.length) {
    grid.textContent = "boot failed - see console";
  }
});
