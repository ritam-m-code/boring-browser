/**
 * Seeded randomness and numeric helpers shared by every theme.
 *
 * Theme-agnostic on purpose: swapping the look should never change how the
 * page decides what "today" looks like. Pure and DOM-free so the test scripts
 * can import it in plain Node.
 */

/** FNV-1a. Stable across runs, unlike anything involving object iteration. */
export function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 - small, fast, good enough for visual noise. */
export function prng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed from a LOCAL calendar date - the art turns over at local midnight. */
export function seedForDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return hashString(`${y}-${m}-${day}`);
}

/** One decimal place. Keeps generated markup byte-identical for a given seed. */
export const r1 = (n) => Math.round(n * 10) / 10;

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Format a list of [x,y] pairs as an SVG points attribute. */
export function pts(points) {
  return points.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
}
