/** Scroll target after match review — next fixture card only. */
export const MANAGER_HUB_SCROLL_TARGET_ID = "manager-hub-scroll-target";

/** @deprecated Use {@link MANAGER_HUB_SCROLL_TARGET_ID} */
export const MANAGER_HUB_NEXT_FIXTURE_ID = MANAGER_HUB_SCROLL_TARGET_ID;

export function scrollToManagerHubNextFixture(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MANAGER_HUB_SCROLL_TARGET_ID);
  if (!el) return;
  // Align to top (scroll-mt on the target clears sticky chrome) — not center,
  // which jumped the viewport to the middle of the page.
  el.scrollIntoView({ behavior: "auto", block: "start" });
}
