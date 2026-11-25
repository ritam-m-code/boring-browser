import sheet from "./clock.css" with { type: "css" };
import { h } from "../../core/dom.js";

/**
 * Per-mount state, keyed on the root node rather than held at module scope,
 * so the tile stays correct if it is ever mounted twice on one page.
 */
const state = new WeakMap();

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n) => String(n).padStart(2, "0");

function render(root, ctx) {
  const s = state.get(root);
  if (!s) return;

  const d = ctx.now();
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;   // 24-hour
  const secs = `:${pad(d.getSeconds())}`;
  const date = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  // Patch only what changed - this runs every second.
  if (s.timeText !== hhmm) {
    s.time.textContent = hhmm;
    s.timeText = hhmm;
  }

  const wantSeconds = ctx.settings.showSeconds !== false;
  if (s.showSeconds !== wantSeconds) {
    s.secs.hidden = !wantSeconds;
    s.showSeconds = wantSeconds;
  }
  if (wantSeconds && s.secsText !== secs) {
    s.secs.textContent = secs;
    s.secsText = secs;
  }

  if (s.dateText !== date) {
    s.date.textContent = date;
    s.dateText = date;
  }
}

export default {
  id: "clock",
  title: "Time",
  span: { cols: 2, rows: 1 },
  tilt: -1.2,
  styles: sheet,

  // "second" drives the display; "wake" repaints immediately after a resume
  // instead of waiting out the next boundary.
  tick: ["second", "wake"],

  requires: { host: [], permissions: [] },

  settings: {
    showSeconds: { kind: "toggle", label: "Show seconds", default: true },
  },

  async mount(root, ctx) {
    const secs = h("span", { class: "clock__secs" });
    const time = h("div", { class: "clock__time" }, secs);
    const date = h("div", { class: "clock__date" });

    // secs must follow the hh:mm text node, so insert the number before it
    const hhmmNode = document.createTextNode("");
    time.insertBefore(hhmmNode, secs);

    root.append(h("div", { class: "clock" }, time, date));

    state.set(root, {
      time: hhmmNode, secs, date,
      timeText: null, secsText: null, dateText: null, showSeconds: null,
    });

    render(root, ctx);
  },

  async update(root, ctx) {
    render(root, ctx);
  },
};
