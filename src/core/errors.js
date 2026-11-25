/**
 * Tile failure containment.
 *
 * This page IS the new tab. A broken tile must never blank it, so every mount
 * and every update is wrapped and failures render in the tile's own slot.
 * The error state is styled on purpose - a red slashed shard reads as part of
 * the aesthetic, where an empty hole in the grid just reads as broken.
 */

import { h, clear } from "./dom.js";

export function renderTileError(parts, { id, error, onRetry }) {
  const { shard, head, body } = parts;

  shard.classList.add("shard--error");
  const title = head.querySelector("h2");
  if (title) title.textContent = `${id} / offline`;

  clear(body);
  body.append(
    h("div", { class: "tile-error" },
      h("div", { class: "tile-error__label", text: "Offline" }),
      h("div", { class: "tile-error__msg", text: String((error && error.message) || error || "unknown error") }),
      onRetry ? h("button", { class: "btn", type: "button", onClick: onRetry, text: "Retry" }) : null
    )
  );

  console.error(`[tile:${id}]`, error);
}

export function clearTileError(parts, { title }) {
  const { shard, head } = parts;
  shard.classList.remove("shard--error");
  const el = head.querySelector("h2");
  if (el) el.textContent = title;
}

/**
 * Trips after `limit` consecutive failures.
 *
 * Without this, a tile whose update() throws every second would spin the CPU
 * of a page opened dozens of times a day.
 */
export function makeBreaker(limit = 3) {
  let fails = 0;
  let open = false;
  return {
    get open() { return open; },
    fail() {
      fails += 1;
      if (fails >= limit) open = true;
      return open;
    },
    pass() {
      fails = 0;
      open = false;
    },
    reset() {
      fails = 0;
      open = false;
    },
  };
}
