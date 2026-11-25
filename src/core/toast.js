/** Shared toast. Used by the Gemini clipboard fallback, among other things. */

let hideTimer = null;

export function createToast(el) {
  return function toast(message, { ms = 2200 } = {}) {
    if (!el) return;
    el.textContent = String(message);
    el.classList.add("is-up");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove("is-up"), ms);
  };
}
