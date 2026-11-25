/**
 * Grid construction.
 *
 * Cells are created BEFORE their tile module is imported, so the grid never
 * jumps once code lands. Span and tilt come from the descriptor, which we only
 * see after loading - so both are cached in storage.local and replayed on the
 * next open. Only the very first load of a brand-new tile can shift.
 */

import { h } from "./dom.js";
import { cacheFor } from "./cache.js";
import { shardClip, shardTilt, shardOffset, lightTiles, tileLabel, hashString } from "./art.js";

const geo = cacheFor("__layout");
const GEO_KEY = "geometry";   // { [id]: {cols, rows, tilt} }

export async function readGeometry() {
  const got = await geo.read(GEO_KEY);
  return (got && got.value) || {};
}

export async function writeGeometry(map) {
  await geo.write(GEO_KEY, map);
}

/**
 * Build one cell. Structure is fixed so every tile gets identical chrome:
 *
 *   section.cell > div.shard > div.shard__inner > [header.shard__head, div.shard__body]
 *
 * The two nested clipped boxes are what give a clip-path'd shard a border.
 */
export function createCell({ id, title, cols = 1, rows = 1, tilt = 0, clip, offset, light = false, label = null }) {
  const titleEl = h("h2", { text: title || id });
  // Themes may add a small header label; P3R uses it for the tile's arcana.
  const labelEl = label ? h("span", { class: "shard__label", text: label }) : null;
  const head = h("header", { class: "shard__head" }, titleEl, labelEl);
  const body = h("div", { class: "shard__body" });
  const inner = h("div", { class: "shard__inner" }, head, body);

  const shard = h("div", {
    class: "shard",
    style: {
      "--tilt": `${tilt}deg`,
      ...(clip ? { "--shard-clip": clip } : {}),
    },
  }, inner);

  // The light treatment and the misregistration offset both live on the CELL:
  // the cell is unclipped, and clip-path would otherwise clip away the
  // drop-shadow that produces the offset copy.
  const cell = h("section", {
    class: light ? "cell cell--light" : "cell",
    dataset: { tile: id },
    style: {
      "--span-cols": String(cols),
      "--span-rows": String(rows),
      ...(offset ? { "--mis-x": `${offset.x}px`, "--mis-y": `${offset.y}px` } : {}),
    },
  }, shard);

  return {
    id, cell, shard, inner, head, body,
    setTitle(next) { titleEl.textContent = next; },
    setSpan(nextCols, nextRows) {
      cell.style.setProperty("--span-cols", String(nextCols));
      cell.style.setProperty("--span-rows", String(nextRows));
    },
    setTilt(next) { shard.style.setProperty("--tilt", `${next}deg`); },
  };
}

/**
 * Create every cell up front, in order, using cached geometry.
 *
 * @param {HTMLElement} gridEl
 * @param {Array<{id:string, load:Function}>} entries
 * @param {{daySeed:number, order?:string[]|null, hidden?:object}} opts
 * @returns {Promise<Map<string, object>>}
 */
export async function buildCells(gridEl, entries, { daySeed, order = null, hidden = {} } = {}) {
  const geometry = await readGeometry();

  let list = entries.filter((e) => !hidden[e.id]);
  if (Array.isArray(order) && order.length) {
    const rank = new Map(order.map((id, i) => [id, i]));
    list = [...list].sort(
      (a, b) => (rank.has(a.id) ? rank.get(a.id) : 999) - (rank.has(b.id) ? rank.get(b.id) : 999)
    );
  }

  // Guaranteed mix of cream slabs and black panels, stable across days.
  const light = lightTiles(list.map((e) => e.id));

  const cells = new Map();
  for (const entry of list) {
    // Seed per tile so each shard is cut differently, but stably within a day.
    const seed = (daySeed ^ hashString(entry.id)) >>> 0;
    const cached = geometry[entry.id] || {};
    const parts = createCell({
      id: entry.id,
      title: cached.title || entry.id,
      cols: cached.cols || 1,
      rows: cached.rows || 1,
      tilt: typeof cached.tilt === "number" ? cached.tilt : shardTilt(seed),
      clip: shardClip(seed),
      offset: shardOffset(seed),
      light: light.has(entry.id),
      label: tileLabel(entry.id),
    });
    parts.seed = seed;
    gridEl.append(parts.cell);
    cells.set(entry.id, parts);
  }

  return cells;
}

/**
 * Persist what we learned from the descriptors, so the next open lays out
 * correctly before any tile code runs.
 */
export async function rememberGeometry(cells, descriptors) {
  const map = await readGeometry();
  let changed = false;

  for (const [id, desc] of descriptors) {
    if (!desc) continue;
    const cols = (desc.span && desc.span.cols) || 1;
    const rows = (desc.span && desc.span.rows) || 1;
    const tilt = typeof desc.tilt === "number" ? desc.tilt : (map[id] && map[id].tilt);
    const title = desc.title || id;
    const prev = map[id] || {};
    if (prev.cols !== cols || prev.rows !== rows || prev.tilt !== tilt || prev.title !== title) {
      map[id] = { cols, rows, tilt, title };
      changed = true;
    }
  }

  if (changed) await writeGeometry(map);
}
