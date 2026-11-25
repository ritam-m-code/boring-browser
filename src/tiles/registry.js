/**
 * THE TILE MANIFEST.
 *
 * Adding a tile is one file plus one line here. Removing one is deleting a line.
 *
 * These are lazy thunks, not static imports, and that is load-bearing: with
 * `import` statements a single syntax error in any tile file would fail the
 * whole module graph and the new tab would render black. A dynamic import can
 * be wrapped in try/catch per tile, so one broken tile costs one shard.
 */

export default [
  { id: "clock", load: () => import("./clock/clock.js") },
];
