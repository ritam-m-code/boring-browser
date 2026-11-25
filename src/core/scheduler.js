/**
 * The one timer.
 *
 * Tiles never call setInterval. They declare a cadence and core calls their
 * update(). That means no drift between tiles, no leaked timers, and a single
 * place to stop everything when the tab is hidden.
 *
 * Cadences:
 *   "second"    - on the wall-clock second boundary (so the clock never skips)
 *   "minute"    - when the local minute changes
 *   "midnight"  - when the local calendar date changes (DST-safe: compared as
 *                 a date string, never as a fixed 24h offset)
 *   "wake"      - tab became visible, or a tick gap far exceeded its interval,
 *                 which is how a laptop resume gets caught
 *   {every: ms} - elapsed-time interval
 */

const TICK_MS = 1000;
const WAKE_GAP_MS = 2500;   // >2.5x the tick interval means we were not running

/** Local calendar day, not UTC. */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalize(ticks) {
  const list = Array.isArray(ticks) ? ticks : [ticks];
  const out = { second: false, minute: false, midnight: false, wake: false, every: null };
  for (const t of list) {
    if (t === "second") out.second = true;
    else if (t === "minute") out.minute = true;
    else if (t === "midnight") out.midnight = true;
    else if (t === "wake") out.wake = true;
    else if (t && typeof t.every === "number") {
      out.every = out.every == null ? t.every : Math.min(out.every, t.every);
    }
  }
  return out;
}

export function createScheduler({ now = () => new Date() } = {}) {
  const subs = new Set();
  let timer = null;
  let running = false;
  let lastTickAt = Date.now();
  let lastMinute = now().getMinutes();
  let lastDate = dateKey(now());

  function fire(sub, reason) {
    try {
      const r = sub.fn(reason);
      if (r && typeof r.catch === "function") {
        r.catch((e) => console.error(`[scheduler] ${sub.label} update rejected`, e));
      }
    } catch (e) {
      console.error(`[scheduler] ${sub.label} update threw`, e);
    }
  }

  function step() {
    const t = now();
    const wallNow = Date.now();
    const gap = wallNow - lastTickAt;
    const wasAsleep = gap > WAKE_GAP_MS;
    lastTickAt = wallNow;

    const minuteChanged = t.getMinutes() !== lastMinute;
    const today = dateKey(t);
    const dayChanged = today !== lastDate;
    lastMinute = t.getMinutes();
    lastDate = today;

    for (const sub of subs) {
      if (sub.paused) continue;
      const k = sub.kinds;

      // Most significant reason wins, so a tile gets one call per tick.
      let reason = null;
      if (k.midnight && dayChanged) reason = "midnight";
      else if (k.wake && wasAsleep) reason = "wake";
      else if (k.second) reason = "tick";
      else if (k.minute && minuteChanged) reason = "tick";
      else if (k.every != null && wallNow - sub.lastEvery >= k.every) reason = "tick";

      if (reason) {
        if (k.every != null && (reason === "tick" || reason === "wake")) sub.lastEvery = wallNow;
        fire(sub, reason);
      }
    }

    schedule();
  }

  function schedule() {
    if (!running) return;
    // Align to the next second boundary, with 4ms of slack so we land just
    // after it rather than just before.
    const delay = TICK_MS - (Date.now() % TICK_MS) + 4;
    timer = setTimeout(step, delay);
  }

  function start() {
    if (running) return;
    running = true;
    lastTickAt = Date.now();
    schedule();
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function onVisibility() {
    if (document.hidden) {
      stop();
    } else {
      // Resuming counts as waking: anything cadence-driven may be stale.
      lastTickAt = 0;
      start();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  return {
    /**
     * @param {string|object|Array} ticks  cadence declaration
     * @param {(reason:string)=>void} fn
     * @param {{label?:string, signal?:AbortSignal}} opts
     */
    subscribe(ticks, fn, { label = "tile", signal } = {}) {
      const sub = { kinds: normalize(ticks), fn, label, lastEvery: Date.now(), paused: false };
      subs.add(sub);
      if (signal) signal.addEventListener("abort", () => subs.delete(sub), { once: true });
      return {
        cancel: () => subs.delete(sub),
        pause: () => { sub.paused = true; },
        resume: () => { sub.paused = false; sub.lastEvery = Date.now(); },
      };
    },

    start,
    stop,

    /** Manual kick, used by retry buttons and the settings overlay. */
    fireAll(reason = "manual") {
      for (const sub of subs) if (!sub.paused) fire(sub, reason);
    },
  };
}
