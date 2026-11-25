/**
 * Persona 5 theme - generative art.
 *
 * Cut-paper collage: hard diagonal bands, torn corner wedges, halftone
 * patches, jagged many-vertex tile silhouettes, and a hard misregistration
 * offset behind every shard.
 *
 * Kept alongside the P3R theme rather than deleted, so the two can be
 * compared by flipping the switch in core/art.js + styles/theme.css.
 */

import { prng, hashString, r1, range, pick, pts } from "../../core/random.js";

const VIEW_W = 1600;
const VIEW_H = 1000;

/** A long band crossing the canvas at a steep slant, with per-vertex jitter. */
function band(rng, { width, lean, jitter = 14 }) {
  // Biased away from the horizontal middle, so the centre of the page - where
  // the tiles live - stays calm and the gesture happens out at the edges.
  const t = rng() < 0.5 ? range(rng, -0.15, 0.36) : range(rng, 0.64, 1.15);
  const cx = t * VIEW_W;
  const dx = lean * VIEW_H;
  const j = () => range(rng, -jitter, jitter);
  const over = 80;   // overshoot so no end cap is ever visible
  return [
    [cx - width / 2 + j(), -over + j()],
    [cx + width / 2 + j(), -over + j()],
    [cx + width / 2 + dx + j(), VIEW_H + over + j()],
    [cx - width / 2 + dx + j(), VIEW_H + over + j()],
  ];
}

/** A torn wedge anchored to one corner, for the print-bleed look. */
function wedge(rng, corner) {
  const w = range(rng, 0.14, 0.34) * VIEW_W;
  const hh = range(rng, 0.2, 0.5) * VIEW_H;
  const j = () => range(rng, -26, 26);
  const [ax, ay] = corner;
  const sx = ax === 0 ? 1 : -1;
  const sy = ay === 0 ? 1 : -1;
  return [
    [ax, ay],
    [ax + sx * w + j(), ay + j()],
    [ax + sx * range(rng, 0.1, 0.4) * w + j(), ay + sy * hh + j()],
  ];
}

export function collageSVG(seed, { w = VIEW_W, h = VIEW_H } = {}) {
  const rng = prng(seed);
  const parts = [];

  parts.push(
    `<defs>` +
      `<pattern id="pb-dots" width="7" height="7" patternUnits="userSpaceOnUse">` +
        `<circle cx="1.6" cy="1.6" r="1.5" fill="#e4002b"/>` +
      `</pattern>` +
      `<pattern id="pb-dots-w" width="9" height="9" patternUnits="userSpaceOnUse">` +
        `<circle cx="2" cy="2" r="1.4" fill="#f5f1e6"/>` +
      `</pattern>` +
    `</defs>`
  );

  const corners = [[0, 0], [VIEW_W, 0], [0, VIEW_H], [VIEW_W, VIEW_H]];
  const nWedge = 1 + Math.floor(rng() * 2);
  const used = new Set();
  for (let i = 0; i < nWedge; i++) {
    let idx = Math.floor(rng() * corners.length);
    while (used.has(idx)) idx = (idx + 1) % corners.length;
    used.add(idx);
    parts.push(
      `<polygon points="${pts(wedge(rng, corners[idx]))}" fill="#8e0019" opacity="${r1(range(rng, 0.18, 0.32))}"/>`
    );
  }

  const nBands = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < nBands; i++) {
    const lean = pick(rng, [-0.85, -0.6, -0.4, 0.4, 0.6, 0.85]) * range(rng, 0.8, 1.2);
    const width = range(rng, 50, 190);
    parts.push(
      `<polygon points="${pts(band(rng, { width, lean }))}" fill="#e4002b" opacity="${r1(range(rng, 0.07, 0.16))}"/>`
    );
  }

  const nDots = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < nDots; i++) {
    const lean = pick(rng, [-0.7, -0.45, 0.45, 0.7]);
    const fill = rng() > 0.72 ? "url(#pb-dots-w)" : "url(#pb-dots)";
    parts.push(
      `<polygon points="${pts(band(rng, { width: range(rng, 80, 210), lean, jitter: 22 }))}" ` +
      `fill="${fill}" opacity="${r1(range(rng, 0.13, 0.24))}"/>`
    );
  }

  const nLines = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nLines; i++) {
    const lean = pick(rng, [-0.9, -0.5, 0.5, 0.9]);
    parts.push(
      `<polygon points="${pts(band(rng, { width: range(rng, 1.5, 4), lean, jitter: 5 }))}" ` +
      `fill="#f5f1e6" opacity="${r1(range(rng, 0.05, 0.12))}"/>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `preserveAspectRatio="xMidYMid slice" role="presentation">${parts.join("")}</svg>`
  );
}

/** Jagged cut-paper silhouette. Mixes px and % so corner cuts stay a fixed size. */
export function shardClip(seed, { cut = 26 } = {}) {
  const rng = prng(seed);
  const jit = (n) => r1(Math.abs(range(rng, 0, n)));

  const cutTR = r1(range(rng, cut * 0.9, cut * 1.8));
  const cutBL = r1(range(rng, cut * 0.9, cut * 1.8));
  const cutBR = r1(range(rng, 5, 13));
  const notchR = r1(range(rng, 5, 11));
  const notchL = r1(range(rng, 5, 11));
  const yR = r1(range(rng, 40, 64));
  const yL = r1(range(rng, 30, 58));

  const px = (n) => `${r1(n)}px`;
  const fromR = (n) => `calc(100% - ${px(n)})`;
  const fromB = (n) => `calc(100% - ${px(n)})`;

  const v = [
    [px(jit(3)), px(jit(2))],
    [fromR(cutTR + jit(4)), px(jit(3))],
    ["100%", px(cutTR + jit(3))],
    [fromR(notchR), `${yR}%`],
    ["100%", `${r1(yR + range(rng, 5, 10))}%`],
    ["100%", fromB(cutBR + jit(3))],
    [fromR(cutBR + jit(3)), "100%"],
    [px(cutBL + jit(4)), "100%"],
    [px(jit(2)), fromB(cutBL + jit(3))],
    [px(notchL), `${yL}%`],
    [px(jit(2)), `${r1(yL - range(rng, 5, 10))}%`],
  ];

  return `polygon(${v.map(([x, y]) => `${x} ${y}`).join(", ")})`;
}

/** ~1 degree reads as a mistake; 1.4-3.4 reads as a choice. */
export function shardTilt(seed) {
  const rng = prng(seed);
  const mag = range(rng, 1.4, 3.4);
  return r1(rng() > 0.5 ? mag : -mag);
}

/** The misprinted-comic offset. Only works if it is obvious. */
export function shardOffset(seed) {
  const rng = prng(seed);
  const x = r1(range(rng, 15, 22)) * (rng() > 0.5 ? 1 : -1);
  const y = r1(range(rng, 15, 22));
  return { x, y };
}

/**
 * Which tiles get the cream paper slab. Ranks stable per-id hashes rather than
 * thresholding each independently, so the mix is GUARANTEED - never all-cream
 * or all-black, whatever set of tiles is registered.
 */
export function lightTiles(ids, ratio = 0.4) {
  const k = Math.max(1, Math.round(ids.length * ratio));
  const ranked = [...ids].sort((a, b) => {
    const ha = hashString("slab:" + a);
    const hb = hashString("slab:" + b);
    return ha === hb ? (a < b ? -1 : 1) : ha - hb;
  });
  return new Set(ranked.slice(0, k));
}
