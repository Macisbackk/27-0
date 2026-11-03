/**
 * Routes whose JS includes the player database (~3 MB of data, built into a registry on load).
 * A plain <Link> prefetches its route as soon as the link is on screen, and the bottom nav and
 * home hub link to /play on every page, so every page load on a phone also downloaded the whole
 * database while it was still loading. Links to these routes use `prefetch={linkPrefetch(href)}`
 * (no prefetch while the page loads); DeferredRoutePrefetch warms /play once the page has settled.
 */
const HEAVY_ROUTES = ["/play", "/profile", "/squad-book", "/showcase", "/mini-games/grid", "/mini-games/wordle"];

export function isHeavyRoute(href: string): boolean {
  const path = href.split(/[?#]/)[0] || "/";
  return HEAVY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
}

/** For <Link prefetch>: false for heavy routes, otherwise Next's default. */
export function linkPrefetch(href: string): false | undefined {
  return isHeavyRoute(href) ? false : undefined;
}

/** Heavy routes worth warming in the background once a page has finished loading. */
export const DEFERRED_PREFETCH_ROUTES = ["/play"];
