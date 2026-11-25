/**
 * Tiny DOM helpers. No framework, no build step.
 *
 * MV3's extension_pages CSP forbids inline handlers and eval, so everything
 * here goes through addEventListener and createElement. Nothing in this file
 * ever evaluates a string as code.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

function applyProps(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;

    if (k === "class") {
      el.setAttribute("class", v);
    } else if (k === "text") {
      el.textContent = String(v);
    } else if (k === "html") {
      // Explicit opt-in, used only for SVG we generated ourselves.
      el.innerHTML = v;
    } else if (k === "style" && typeof v === "object") {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith("--")) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    } else if (k === "dataset" && typeof v === "object") {
      Object.assign(el.dataset, v);
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "value" || k === "checked" || k === "disabled") {
      el[k] = v;
    } else {
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Create an HTML element. h("div", {class: "x"}, "text", childNode) */
export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

/** Create an SVG element. Needs createElementNS, so it cannot share h(). */
export function s(tag, props = null, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Keyed list reconciliation. Patches in place rather than rebuilding, which
 * is what keeps the grid from shifting when fresh data lands.
 *
 * Children are tagged with data-key, so only nodes this function created are
 * ever reused or removed.
 */
export function patchList(container, items, { key, create, update }) {
  const existing = new Map();
  for (const node of Array.from(container.children)) {
    const k = node.dataset ? node.dataset.key : null;
    if (k != null) existing.set(k, node);
  }

  let prev = null;
  for (const item of items) {
    const k = String(key(item));
    let node = existing.get(k);

    if (node) {
      existing.delete(k);
      if (update) update(node, item);
    } else {
      node = create(item);
      node.dataset.key = k;
    }

    const target = prev ? prev.nextSibling : container.firstChild;
    if (node !== target) container.insertBefore(node, target);
    prev = node;
  }

  for (const node of existing.values()) node.remove();
}
