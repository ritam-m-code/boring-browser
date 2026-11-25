/**
 * Theme adapter.
 *
 * ============================================================
 *   THE THEME SWITCH - change this one import and the CSS one
 *   in src/styles/theme.css, and the whole page changes look.
 * ============================================================
 *
 * Nothing in core/ or tiles/ imports a theme directly; they import from here.
 * Every theme module must satisfy the interface below, and anything a theme
 * omits falls back to an inert default, so a minimal theme only has to export
 * collageSVG.
 *
 * Theme interface
 *   collageSVG(seed, {w, h, date}) -> string   the background, as <svg> markup
 *   shardClip(seed)   -> string|null           CSS clip-path for a tile, or null
 *   shardTilt(seed)   -> number                rotation in degrees
 *   shardOffset(seed) -> {x, y}                misregistration offset in px
 *   lightTiles(ids)   -> Set<string>           which tiles use the light treatment
 *   tileLabel(id)     -> string|null           small header label (P3R: the arcana)
 *   bleedText(date)   -> string|null           oversized word behind the page
 */

import * as theme from "../themes/p3r/art.js";

export { hashString, prng, seedForDate } from "./random.js";

export const collageSVG  = theme.collageSVG;
export const shardClip   = theme.shardClip   ?? (() => null);
export const shardTilt   = theme.shardTilt   ?? (() => 0);
export const shardOffset = theme.shardOffset ?? (() => ({ x: 0, y: 0 }));
export const lightTiles  = theme.lightTiles  ?? (() => new Set());
export const tileLabel   = theme.tileLabel   ?? (() => null);
export const bleedText   = theme.bleedText   ?? (() => null);

/** Everything else a theme chooses to expose (P3R: moon phase helpers). */
export const themeExtras = theme;
