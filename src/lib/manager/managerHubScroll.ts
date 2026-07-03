/** Anchor for the hub "Next Fixture" card — scroll here after match review. */
export const MANAGER_HUB_NEXT_FIXTURE_ID = "manager-hub-next-fixture";

export function scrollToManagerHubNextFixture(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MANAGER_HUB_NEXT_FIXTURE_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: "auto", block: "start" });
}
