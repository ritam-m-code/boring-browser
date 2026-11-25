# Pretty Browser — build log

Full spec: `C:\Users\ritam\.claude\plans\partitioned-leaping-hamming.md`

## Phase 0 — Frame

- [x] Directory skeleton
- [x] Vendor fonts (Barlow Condensed 900 + 900i display, Saira Condensed 600 UI; 63KB)
- [x] `manifest.json` — MV3, no `background`, no `oauth2` yet, `permissions: ["storage"]`
- [x] `newtab.html`
- [x] `src/styles/theme.css` — P5 token set, halftone, shard classes
- [x] `src/core/dom.js` — `h()`, `s()`, `patchList()`
- [x] `src/core/storage.js` — namespaced sync wrapper
- [x] `src/core/cache.js` — namespaced local wrapper + `swr()`
- [x] `src/core/scheduler.js` — one aligned timer: second/minute/midnight/wake/every
- [x] `src/core/errors.js` — error shard + circuit breaker
- [x] `src/core/layout.js` — grid cells, span cache
- [x] `src/core/art.js` — seeded PRNG, generative collage, cut-paper paths
- [x] `src/app.js` — boot + per-tile isolation loop
- [x] `src/tiles/registry.js` — lazy thunks
- [x] `src/tiles/clock/` — 24h clock
- [x] `tools/test-art.mjs` — PRNG determinism
- [x] Verify: loads unpacked, no CSP violations, break a tile and the rest survives

### Phase 0c - pivot to Persona 3 Reload

P5 was fighting the use case: its devices (jagged silhouettes, heavy skew, max-saturation
red) are built for a 30-second menu interaction, not a surface opened 50x/day. They eat
content area and fight the alignment a checklist and a due list want.

Research confirmed the new direction is the reference's own brief: P3R's art director
built the UI from **water and bubble motifs** (Port Island, the Yakushima Sea) with a
distorted underwater background, explicitly contrasted against P5's "pop-punk". Dark Hour
is documented as sickly green sky/moon with blood-red water.

**Themes are now swappable modules.** Two one-line switches, both labelled:
  - `src/core/art.js`      -> `import * as theme from "../themes/<name>/art.js"`
  - `src/styles/theme.css` -> `@import url("../themes/<name>/theme.css")`

`core/art.js` is an adapter that fills in inert defaults, so a minimal theme need only
export `collageSVG`. P5 is preserved intact under `src/themes/p5/`, not deleted.

**Theme contract for tiles.** Tile stylesheets may use ONLY `--display`, `--ui`,
`--display-weight`, `--display-skew`, `--display-tracking`, `--ink-on`, `--muted-on`,
`--accent`. The clock was carrying `skewX(-8deg)` and `font-weight: 900` directly, which
is P5 styling living in a tile - fixed, and the rule is now documented in `clock.css` as
the pattern for every tile to come.

**P3R specifics**
- Real **lunar phase**, computed locally from the synodic month, drawn as an SVG arc pair.
  Replaces the collage as the daily generative art and is *meaningful* rather than decorative.
- **The Dark Hour**: `:root[data-hour="0"]` swaps the palette green. Nothing in the
  generated SVG is tinted in markup - every element takes colour from CSS - so this is a
  pure token swap with no regeneration. `app.js` keeps `data-hour` current on a
  minute/wake tick, so a tab left open crosses into it without a reload.
- **Arcana per tile** as a small header label (The Fool for the games streak, Death for
  due dates, The Tower for the error shard). This is the entire Persona-reference budget.
- Deliberately NO clip-path, tilt, or misregistration - "sterile means aligned" is
  asserted in the tests so a later edit can't quietly reintroduce them.
- Collage regenerates at local midnight so an overnight tab shows tonight's moon.

Two bugs found by rendering, not by reading:
- `--abyss: #05070300` - an 8-digit hex with **zero alpha**. The Dark Hour background
  faded to transparent and the page went grey below the grid.
- The moon sat directly behind a tile and blew out its contrast. Moved into the corner
  and dimmed; it belongs *behind the glass*, not on top of a tile.

Tests: 19 passing, now covering both themes independently plus the moon maths (epoch,
half-cycle, pre-epoch negative-modulo guard, illumination curve, path validity at 41
phases, and that `date` is actually threaded into the collage).

### Phase 0d - matching the real reference

Ritam supplied two P3R screenshots (now in `reference/`): the liquid menu transition and
the main menu. Both showed two things were wrong:

- **The water was far too dark and desaturated.** The real thing is vivid - bright cyan
  at the surface falling through saturated royal blue, with caustics rippling on the
  underside of the waterline and submerged structures visible as silhouettes.
- **The type was thin and widely tracked.** The reference is ITALIC and substantial.

Changed:
- Background rebuilt as a lit underwater *scene*: surface caustics, light shafts anchored
  at the waterline, blurred pillar/railing silhouettes in the murk, bubbles, and the moon
  as the light source the rays belong to. The silhouettes are what make the blue read as
  a place rather than a gradient.
- Vendored Jost italic; `--display-style` added to the theme contract so tiles can slant
  without knowing whether the theme uses a real italic (P3R) or a skew (P5, Anton having
  no italic). Headers are now italic 500 at 19px with a short cyan accent rule.
- `data-depth` (deep | mid | shallow) is a real knob on `<html>`, not a hardcoded palette.
- **The bleed**: one oversized italic word running off the left edge behind everything,
  naming the current day phase. Reads DARK HOUR after midnight, which is the payoff.
  `dayPhase()` is exported and is the single definition of the phase boundaries, so the
  dayphase tile will reuse it rather than redefining them.

Bugs found by rendering:
- The moon was blurred under a large glow and read as lens flare, not a moon - the phase
  was unreadable, which defeats the point. Blur removed, glow cut.
- The collage used `preserveAspectRatio="xMidYMid slice"`, which **cropped the waterline
  off the top of the viewport**. Changed to `xMidYMin` so the surface stays pinned to the
  top of the window whatever the aspect ratio.

Tests: 20 passing, now including full 24-hour day-phase coverage and that the Dark Hour
is exactly one hour rather than the whole night.

## Phase 1 — Zero-network tiles
- [ ] `search` (Google / Gemini+clipboard / Claude)
- [ ] `quicklaunch`
- [ ] `core/settings.js` — six field kinds incl. list editor
- [ ] Gate: adding these two tiles required **zero** edits to `core/`
- [ ] Verify omnibox focus behaviour by hand

## Phase 2 — Games + art
- [ ] `games` tile, midnight reset, streak
- [ ] SVG mask + due-today eye state
- [ ] Cut-paper frame jitter across all tiles

## Phase 3 — Weather
- [ ] `weather` tile, Open-Meteo, `cache.swr`, WMO-code SVG icons

## Phase 4 — Dates + due + command bar  (STOP: live with it a few days)
- [ ] `core/dates.js` + `tools/test-dates.mjs` green
- [ ] `core/commands.js` + command bar
- [ ] `due` tile against `store-local.js`
- [ ] Inert CONNECT button + inert day-phase bar

## Phase 5 — Google
- [ ] `docs/SETUP-GOOGLE.md` runbook
- [ ] `oauth.js` + `backend-chrome.js` + `calendar.js` + `store-calendar.js`
- [ ] `dayphase` tile live
- [ ] One-shot `due.local` migration on first connect

## Phase 6 — Polish
- [ ] Reorder/hide tiles (up/down buttons)
- [ ] Interaction motion, `prefers-reduced-motion`

## Review

### Phase 0 — done 2026-11-24

Built the frame and the modularity contract. Verified by rendering the real page in
headless Chrome against a stubbed `chrome.storage` (`tools/preview.html` +
`tools/chrome-stub.js`) — these are dev-only, not referenced by the manifest.

Proven, not assumed:
- 11/11 art determinism tests pass; 28 consecutive days produce 28 distinct collages.
- Error isolation works against **both** failure modes: a tile that throws in `mount()`
  and a registry entry pointing at a module that does not exist. Both rendered error
  shards in their own slots; the clock kept running.
- CSS module scripts (`import sheet from "./x.css" with { type: "css" }`) work in the
  installed Chrome — the clock's styles applied, so `minimum_chrome_version: 123` holds.
- No CSP hazards: no inline script, no `on*` attributes, no eval, no remote subresources.
- Every referenced path resolves (fonts, stylesheets, JS imports).

Two things the screenshots caught that review would not have:
- The collage was far too loud on the first pass — it read as red wallpaper, violating
  the "loud frame, calm content" rule. Tuned down, then back up from an overcorrection.
  Bands are now biased away from the horizontal centre so the tile area stays calm.
- The toast was peeking above the bottom edge at rest: `translateY(140%)` does not clear
  the viewport for a short element. Needed `visibility`/`opacity` as well.

Deviation from plan: the display face is **Anton**, not Saira or Barlow Condensed (see
aesthetic revision below). Saira Condensed 600 is kept for UI text as the pairing.
Total vendored font weight: 37KB.

### Phase 0b - aesthetic revision

First pass was rejected: "not screaming persona 5 to me." Fair - it had P5's palette but
none of its signature devices. Changed, all verified by render:

- **Misregistration** - hard offset colour copy behind every shard (15-22px). Red behind
  cream slabs, cream behind dark panels, because red-on-dark-red was invisible.
- **Cream paper slabs** - `lightTiles()` guarantees a mixed set (never all-cream or
  all-black) by ranking stable per-id hashes, keyed on tile id not date so the page keeps
  a stable identity while the collage changes daily.
- **Jagged silhouettes** - 11 vertices with edge notches, replacing 6-vertex shaved corners.
- **Tilt 1.4-3.4deg**, up from 0.3-1.5. One degree reads as a mistake.
- **Anton** as the display face, replacing Barlow Condensed, which was too thin and clean.
  Anton has no true italic, so every `font-style: italic` was removed - the slant comes
  from `transform: skewX(-8deg)` alone, or the browser stacks a synthetic oblique on top
  of the skew and double-slants it.

Real bug found and fixed in the process: **`clip-path` clips the output of `filter`**, so
the drop-shadow on `.shard` was being generated and immediately clipped away by its own
silhouette. Moved to the unclipped `.cell`, which also meant moving the light-treatment
tokens there so the filter can read them. Diagnosed by dumping computed styles after a
wrong first guess (contrast/scale).

Added `tools/mock.html` as a permanent dev tool: renders a realistic seven-tile grid using
the real `createCell` and art functions, so tile composition can be designed before the
tiles exist.
