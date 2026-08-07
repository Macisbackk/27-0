/** Scroll target after match review — next fixture card only. */
export const MANAGER_HUB_SCROLL_TARGET_ID = "manager-hub-scroll-target";

/** @deprecated Use {@link MANAGER_HUB_SCROLL_TARGET_ID} */
export const MANAGER_HUB_NEXT_FIXTURE_ID = MANAGER_HUB_SCROLL_TARGET_ID;

export function scrollToManagerHubNextFixture(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MANAGER_HUB_SCROLL_TARGET_ID);
  if (!el) return;
  // Prefer nearest so we don't yank past sticky chrome when already nearby.
  // scroll-mt on the target still clears the header when block would be start.
  el.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
}
