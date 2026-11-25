/**
 * Tests for the shared randomness helpers and for EACH theme's art module.
 *
 * Themes are imported directly rather than through core/art.js, so these
 * assertions stay valid no matter which theme the switch currently points at.
 *
 * Run: node tools/test-art.mjs
 */

import assert from "node:assert/strict";
import { hashString, prng, seedForDate } from "../src/core/random.js";
import * as p5 from "../src/themes/p5/art.js";
import * as p3r from "../src/themes/p3r/art.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
}
const section = (s) => console.log(`\n${s}`);

/* ------------------------------------------------------------------ shared */
section("core/random.js");

test("hashString is stable and unsigned", () => {
  assert.equal(hashString("clock"), hashString("clock"));
  assert.notEqual(hashString("clock"), hashString("clock "));
  assert.ok(hashString("x") >= 0);
});

test("prng is reproducible, in range, and non-degenerate", () => {
  const a = prng(12345), b = prng(12345);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  const r = prng(99);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    if (i < 500) seen.add(v);
  }
  assert.ok(seen.size > 490, `too many collisions: ${seen.size}/500`);
});

test("seedForDate uses the LOCAL calendar day", () => {
  const morning = new Date(2026, 10, 24, 6, 30);
  const night = new Date(2026, 10, 24, 23, 59, 59);
  const tomorrow = new Date(2026, 10, 25, 6, 30);
  assert.equal(seedForDate(morning), seedForDate(night));
  assert.notEqual(seedForDate(morning), seedForDate(tomorrow));
});

/* ---------------------------------------------------------------- generic */
for (const [label, theme] of [["p5", p5], ["p3r", p3r]]) {
  section(`themes/${label}/art.js`);

  test(`${label}: collage is byte-identical for one seed`, () => {
    const seed = seedForDate(new Date(2026, 10, 24));
    assert.equal(theme.collageSVG(seed), theme.collageSVG(seed));
  });

  test(`${label}: 28 consecutive days give 28 distinct collages`, () => {
    const svgs = new Set();
    for (let d = 1; d <= 28; d++) {
      svgs.add(theme.collageSVG(seedForDate(new Date(2026, 10, d))));
    }
    assert.equal(svgs.size, 28, `got ${svgs.size} distinct`);
  });

  test(`${label}: collage is well-formed and numerically clean`, () => {
    const svg = theme.collageSVG(seedForDate(new Date(2026, 0, 1)));
    assert.ok(svg.startsWith("<svg"), "does not start with <svg");
    assert.ok(svg.endsWith("</svg>"), "does not end with </svg>");
    assert.ok(!/NaN|undefined|Infinity/.test(svg), "numeric formatting bug");
  });
}

/* --------------------------------------------------------------------- p5 */
section("themes/p5 - cut paper");

test("p5: shardClip is deterministic and differs per tile", () => {
  assert.equal(p5.shardClip(1234), p5.shardClip(1234));
  assert.ok(p5.shardClip(1234).startsWith("polygon("));
  const clips = new Set(
    ["clock", "search", "games", "weather", "due", "quicklaunch"]
      .map((id) => p5.shardClip(hashString(id)))
  );
  assert.equal(clips.size, 6, "two tiles got the same silhouette");
});

test("p5: tilt is deliberate (1.4-3.4 deg), signed, deterministic", () => {
  for (const seed of [1, 2, 3, 400, 50000]) {
    const t = p5.shardTilt(seed);
    assert.equal(t, p5.shardTilt(seed));
    assert.ok(Math.abs(t) >= 1.4 && Math.abs(t) <= 3.4, `tilt out of range: ${t}`);
  }
  assert.ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(p5.shardTilt)).size > 1);
});

test("p5: lightTiles always returns a MIX, never all or nothing", () => {
  // The whole point of ranking hashes instead of thresholding them.
  for (let n = 2; n <= 12; n++) {
    const ids = Array.from({ length: n }, (_, i) => `tile${i}`);
    const lit = p5.lightTiles(ids);
    assert.ok(lit.size >= 1, `n=${n}: nothing light`);
    assert.ok(lit.size < n, `n=${n}: everything light`);
  }
  // and it is stable
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual([...p5.lightTiles(ids)].sort(), [...p5.lightTiles(ids)].sort());
});

/* -------------------------------------------------------------------- p3r */
section("themes/p3r - submerged");

test("p3r: tiles are deliberately unstyled geometry", () => {
  assert.equal(p3r.shardClip(1), null, "P3R must not clip: sterile means aligned");
  assert.equal(p3r.shardTilt(1), 0, "P3R must not tilt");
  assert.deepEqual(p3r.shardOffset(1), { x: 0, y: 0 }, "P3R has no misregistration");
  assert.equal(p3r.lightTiles(["a", "b"]).size, 0, "P3R has no light treatment");
});

test("p3r: every v1 tile has an arcana, and they are unique", () => {
  const ids = ["clock", "weather", "games", "due", "search", "quicklaunch", "dayphase"];
  for (const id of ids) {
    assert.ok(p3r.tileLabel(id), `${id} has no arcana`);
  }
  const nums = Object.values(p3r.ARCANA).map((a) => a.num);
  assert.equal(new Set(nums).size, nums.length, "two tiles share an arcana numeral");
  assert.equal(p3r.tileLabel("nope"), null, "unknown id should not get a label");
});

test("p3r: day phases cover all 24 hours with no gap", () => {
  const seen = new Set();
  for (let h = 0; h < 24; h++) {
    const p = p3r.dayPhase(new Date(2026, 10, 24, h, 30));
    assert.ok(p && typeof p === "string", `hour ${h} has no phase`);
    seen.add(p);
  }
  assert.ok(seen.size >= 5, `expected at least 5 distinct phases, got ${seen.size}`);
  assert.equal(p3r.dayPhase(new Date(2026, 10, 24, 0, 30)), "Dark Hour",
    "hour 0 must be the Dark Hour");
  assert.notEqual(p3r.dayPhase(new Date(2026, 10, 24, 1, 30)), "Dark Hour",
    "the Dark Hour is one hour, not the whole night");
  assert.equal(p3r.bleedText(new Date(2026, 10, 24, 0, 30)), "Dark Hour");
});

test("p3r: moon phase is correct at the known epoch and half a cycle on", () => {
  const SYNODIC = 29.530588853;
  const epoch = new Date(Date.UTC(2000, 0, 6, 18, 14));
  assert.ok(p3r.moonPhase(epoch) < 1e-6, "epoch should be a new moon");

  const full = new Date(epoch.getTime() + (SYNODIC / 2) * 86400000);
  assert.ok(Math.abs(p3r.moonPhase(full) - 0.5) < 1e-6, "half a cycle on should be full");

  // and it wraps rather than running away
  const far = new Date(epoch.getTime() + 1000 * SYNODIC * 86400000);
  const p = p3r.moonPhase(far);
  assert.ok(p >= 0 && p < 1, `phase escaped [0,1): ${p}`);
});

test("p3r: dates BEFORE the epoch still give a phase in [0,1)", () => {
  // The modulo of a negative number is negative in JS - this is the bug guard.
  const old = new Date(1969, 6, 20);
  const p = p3r.moonPhase(old);
  assert.ok(p >= 0 && p < 1, `negative-modulo bug: ${p}`);
});

test("p3r: illumination runs new -> full -> new", () => {
  assert.ok(p3r.moonIllumination(0) < 1e-9, "new moon should be dark");
  assert.ok(Math.abs(p3r.moonIllumination(0.5) - 1) < 1e-9, "full moon should be lit");
  assert.ok(Math.abs(p3r.moonIllumination(0.25) - 0.5) < 1e-9, "quarter should be half");
  assert.ok(Math.abs(p3r.moonIllumination(0.75) - 0.5) < 1e-9);
});

test("p3r: moon path is valid SVG for every phase", () => {
  for (let i = 0; i <= 40; i++) {
    const d = p3r.moonPathD(100, 100, 40, i / 40);
    assert.ok(d.startsWith("M "), `phase ${i / 40}: ${d}`);
    assert.ok(d.endsWith("Z"), `phase ${i / 40}: ${d}`);
    assert.ok(!/NaN|undefined/.test(d), `phase ${i / 40}: ${d}`);
    assert.equal((d.match(/A /g) || []).length, 2, "expected exactly two arcs");
  }
});

test("p3r: the collage reflects the date's moon, not just the seed", () => {
  // Same seed, different moon: proves `date` is actually threaded through.
  const seed = 42;
  const a = p3r.collageSVG(seed, { date: new Date(2026, 0, 1) });
  const b = p3r.collageSVG(seed, { date: new Date(2026, 0, 8) });
  assert.notEqual(a, b, "moon phase is not being used");
});

console.log(
  process.exitCode ? `\n${passed} passed, failures above.` : `\n${passed} passed.`
);
