/** Focus without scrolling the focused element into view (avoids layout jumps). */
export function focusWithoutScroll(
  el: HTMLElement | null | undefined
): void {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}
