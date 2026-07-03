/** Scroll target after match review — season progress + next fixture together. */
export const MANAGER_HUB_SCROLL_TARGET_ID = "manager-hub-scroll-target";

/** @deprecated Use {@link MANAGER_HUB_SCROLL_TARGET_ID} */
export const MANAGER_HUB_NEXT_FIXTURE_ID = MANAGER_HUB_SCROLL_TARGET_ID;

export function scrollToManagerHubNextFixture(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MANAGER_HUB_SCROLL_TARGET_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: "auto", block: "center" });
}
