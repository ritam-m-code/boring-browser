/**
 * Persona 3 Reload theme - generative art.
 *
 * P3R's art director built the game's UI from water and bubble motifs - Port
 * Island, the Yakushima Sea, the protagonist's inner mind - with a distorted,
 * underwater pause-menu background. This follows that brief: submerged,
 * clean, sterile, with the Persona references kept quiet.
 *
 * Nothing here is tinted in the markup. Every themeable element carries a
 * class and takes its colour from CSS, which is what lets the Dark Hour be a
 * pure stylesheet switch rather than a regeneration.
 *
 * Pure and DOM-free, so tools/ can import it in plain Node.
 */

import { prng, r1, range, pts } from "../../core/random.js";

const VIEW_W = 1600;
const VIEW_H = 1000;

/* --- the arcana ----------------------------------------------------------- */

/**
 * Each tile is a Major Arcana. This is the whole "hint of the Persona-ness"
 * budget - a small tracked label in the header, nothing costumed. It reads as
 * a quiet system to anyone who knows, and as a tidy numbering to anyone who
 * doesn't.
 *
 * The mappings are chosen, not arbitrary:
 *   games  - The Fool is the protagonist's own arcana and the one that ranks
 *            up through the game, which is exactly what a daily streak is.
 *   due    - Death. Deadlines, and the arcana at the centre of P3's story.
 *   error  - The Tower. Collapse. A broken tile earns it.
 */
export const ARCANA = {
  clock:       { num: "XXI",  name: "The World" },
  weather:     { num: "XIX",  name: "The Sun" },
  games:       { num: "0",    name: "The Fool" },
  due:         { num: "XIII", name: "Death" },
  search:      { num: "IX",   name: "The Hermit" },
  quicklaunch: { num: "I",    name: "The Magician" },
  dayphase:    { num: "XVIII", name: "The Moon" },
  settings:    { num: "V",    name: "The Hierophant" },
  command:     { num: "II",   name: "The Priestess" },
  error:       { num: "XVI",  name: "The Tower" },
};

export function tileLabel(id) {
  const a = ARCANA[id];
  return a ? `${a.num} · ${a.name}` : null;
}

/* --- the day phase -------------------------------------------------------- */

/**
 * P3 runs on time-of-day blocks, and names them constantly. Same idea here.
 * Hour 0 is the Dark Hour - the hidden 25th hour between one day and the next.
 *
 * Exported because the dayphase tile will want the same boundaries; this is
 * the single definition of them.
 */
export function dayPhase(date) {
  const h = date.getHours();
  if (h === 0) return "Dark Hour";
  if (h < 6) return "Late Night";
  if (h < 11) return "Morning";
  if (h < 16) return "Daytime";
  if (h < 19) return "After School";
  return "Evening";
}

/**
 * The oversized word bleeding off the left edge, behind everything.
 * Atmosphere only - it is aria-hidden and never carries information that is
 * not already on the page.
 */
export function bleedText(date = new Date()) {
  return dayPhase(date);
}

/* --- the moon ------------------------------------------------------------- */

const SYNODIC = 29.530588853;                        // mean lunar month, days
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/**
 * Lunar phase as a fraction of the synodic month.
 * 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
 *
 * Mean-phase approximation: good to roughly a few hours, which is far more
 * precision than a background graphic needs, and it costs no network call.
 */
export function moonPhase(date) {
  const days = (date.getTime() - NEW_MOON_EPOCH) / 86400000;
  let p = (days / SYNODIC) % 1;
  if (p < 0) p += 1;
  return p;
}

/** Illuminated fraction of the disc, 0 at new and 1 at full. */
export function moonIllumination(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/**
 * SVG path for the LIT part of the disc.
 *
 * Outer edge is a semicircle around the lit limb; the inner edge is an
 * elliptical arc whose horizontal radius is the cosine of the phase angle, so
 * it collapses to a straight line at the quarters and to the full limb at new
 * and full. Sweep flags decide whether the terminator bows toward the lit side
 * (crescent) or away from it (gibbous).
 */
export function moonPathD(cx, cy, r, phase) {
  const k = Math.cos(2 * Math.PI * phase);   // +1 at new, -1 at full
  const rx = Math.abs(k) * r;
  const waxing = phase < 0.5;
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  const top = `${r1(cx)},${r1(cy - r)}`;
  const bot = `${r1(cx)},${r1(cy + r)}`;
  return `M ${top} A ${r1(r)},${r1(r)} 0 0 ${outerSweep} ${bot} ` +
         `A ${r1(rx)},${r1(r)} 0 0 ${innerSweep} ${top} Z`;
}

/* --- the submerged field -------------------------------------------------- */

const SURFACE_Y = VIEW_H * 0.1;   // where the water surface sits

/**
 * A shaft of light falling from the surface, fanning out as it descends.
 * Anchored at the surface rather than the top of the frame, so the rays and
 * the caustics read as the same light source.
 */
function ray(rng) {
  const topX = range(rng, -0.05, 1.05) * VIEW_W;
  const topW = range(rng, 24, 90);
  const spread = range(rng, 2, 4.6);
  const lean = range(rng, -0.35, 0.35) * VIEW_H;
  const len = range(rng, 0.6, 1.25) * VIEW_H;
  return [
    [topX - topW / 2, SURFACE_Y],
    [topX + topW / 2, SURFACE_Y],
    [topX + (topW * spread) / 2 + lean, len],
    [topX - (topW * spread) / 2 + lean, len],
  ];
}

/** One rippling caustic line on the underside of the surface. */
function caustic(rng, y, amp) {
  const segs = 5;
  const step = (VIEW_W + 160) / segs;
  let d = `M -80,${r1(y)}`;
  for (let i = 0; i < segs; i++) {
    const x0 = -80 + step * i;
    const dir = i % 2 === 0 ? -1 : 1;
    d += ` Q ${r1(x0 + step * 0.5)},${r1(y + dir * amp)} ${r1(x0 + step)},${r1(y)}`;
  }
  return d;
}

export function collageSVG(seed, { w = VIEW_W, h = VIEW_H, date = new Date() } = {}) {
  const rng = prng(seed);
  const parts = [];

  parts.push(
    `<defs>` +
      `<radialGradient id="p3-glow-g">` +
        `<stop class="p3-glow-in" offset="0%"/>` +
        `<stop class="p3-glow-mid" offset="55%"/>` +
        `<stop class="p3-glow-out" offset="100%"/>` +
      `</radialGradient>` +
      `<filter id="p3-blur-lg" x="-60%" y="-60%" width="220%" height="220%">` +
        `<feGaussianBlur stdDeviation="34"/></filter>` +
      `<filter id="p3-blur-sm" x="-60%" y="-60%" width="220%" height="220%">` +
        `<feGaussianBlur stdDeviation="7"/></filter>` +
    `</defs>`
  );

  // 1. submerged structures, far off in the murk. Faint, but they are what
  //    make the blue read as a PLACE rather than as a gradient.
  const nPillar = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < nPillar; i++) {
    const x = range(rng, -0.05, 1.05) * VIEW_W;
    const wNarrow = range(rng, 40, 170);
    const top = range(rng, 0.3, 0.62) * VIEW_H;
    parts.push(
      `<rect class="p3-silhouette" x="${r1(x)}" y="${r1(top)}" ` +
      `width="${r1(wNarrow)}" height="${r1(VIEW_H - top + 40)}" ` +
      `opacity="${r1(range(rng, 0.1, 0.26))}" filter="url(#p3-blur-sm)"/>`
    );
  }
  // a couple of horizontal rails, like railings seen through water
  for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
    const y = range(rng, 0.45, 0.8) * VIEW_H;
    parts.push(
      `<rect class="p3-silhouette" x="-40" y="${r1(y)}" width="${VIEW_W + 80}" ` +
      `height="${r1(range(rng, 4, 11))}" opacity="${r1(range(rng, 0.08, 0.18))}" ` +
      `filter="url(#p3-blur-sm)"/>`
    );
  }

  // 2. the moon, at its real phase, sitting ABOVE the surface - it is the
  //    light source the rays and caustics below belong to.
  // Crisp, not blurred: the whole point is that the phase is READABLE. A
  // blurred disc under a big glow just reads as a lens flare.
  const phase = moonPhase(date);
  const mx = VIEW_W * 0.9;
  const my = VIEW_H * 0.17;
  const mr = 80;
  parts.push(
    `<circle class="p3-glow" cx="${mx}" cy="${r1(my)}" r="${mr * 2.8}" fill="url(#p3-glow-g)"/>` +
    `<circle class="p3-moon-dark" cx="${mx}" cy="${r1(my)}" r="${mr}"/>` +
    `<path class="p3-moon" d="${moonPathD(mx, my, mr, phase)}"/>`
  );

  // 3. light shafts from the surface
  const nRays = 6 + Math.floor(rng() * 5);
  for (let i = 0; i < nRays; i++) {
    parts.push(
      `<polygon class="p3-ray" points="${pts(ray(rng))}" ` +
      `opacity="${r1(range(rng, 0.14, 0.36))}" filter="url(#p3-blur-lg)"/>`
    );
  }

  // 4. the surface itself: bright caustics rippling on its underside,
  //    densest right at the waterline and thinning as they descend
  const nCaustic = 10 + Math.floor(rng() * 7);
  for (let i = 0; i < nCaustic; i++) {
    const t = i / nCaustic;
    const y = SURFACE_Y * range(rng, -0.5, 0.4) + t * VIEW_H * 0.3;
    const amp = range(rng, 5, 22) * (1 - t * 0.6);
    parts.push(
      `<path class="p3-caustic" d="${caustic(rng, y, amp)}" fill="none" ` +
      `stroke-width="${r1(range(rng, 1.5, 6))}" ` +
      `opacity="${r1(range(rng, 0.1, 0.42) * (1 - t * 0.75))}" filter="url(#p3-blur-sm)"/>`
    );
  }

  // 5. slower ripple hairlines further down
  const nRipple = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < nRipple; i++) {
    const y = range(rng, 0.35, 0.95) * VIEW_H;
    const amp = range(rng, 8, 30);
    const d =
      `M -40,${r1(y)} ` +
      `C ${r1(VIEW_W * 0.25)},${r1(y - amp)} ${r1(VIEW_W * 0.5)},${r1(y + amp)} ${r1(VIEW_W * 0.75)},${r1(y)} ` +
      `S ${r1(VIEW_W + 40)},${r1(y - amp * 0.6)} ${VIEW_W + 60},${r1(y)}`;
    parts.push(
      `<path class="p3-ripple" d="${d}" fill="none" opacity="${r1(range(rng, 0.07, 0.2))}"/>`
    );
  }

  // 4. bubbles. CSS animates these very slowly, and disables it entirely
  //    under prefers-reduced-motion.
  const nBub = 18 + Math.floor(rng() * 14);
  for (let i = 0; i < nBub; i++) {
    const cx = r1(range(rng, 0, VIEW_W));
    const cy = r1(range(rng, 0, VIEW_H));
    const rr = r1(range(rng, 1.6, 8));
    const dur = r1(range(rng, 42, 110));
    const delay = r1(-range(rng, 0, dur));
    parts.push(
      `<circle class="p3-bub" cx="${cx}" cy="${cy}" r="${rr}" ` +
      `opacity="${r1(range(rng, 0.08, 0.3))}" ` +
      `style="animation-duration:${dur}s;animation-delay:${delay}s"/>`
    );
  }

  // yMin, not yMid: the surface and its caustics must stay pinned to the top
  // of the viewport. Centring the artwork crops the waterline away.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `preserveAspectRatio="xMidYMin slice" role="presentation">${parts.join("")}</svg>`
  );
}

/* --- tile geometry: deliberately none ------------------------------------- */

/**
 * No jagged silhouette, no tilt, no misregistration.
 *
 * This is the point of the P3R theme rather than an omission: "clean, sterile"
 * means precise alignment. The character comes from the field behind the
 * tiles, the translucency, and the arcana - not from roughing up their edges.
 */
export function shardClip() { return null; }
export function shardTilt() { return 0; }
export function shardOffset() { return { x: 0, y: 0 }; }
export function lightTiles() { return new Set(); }
