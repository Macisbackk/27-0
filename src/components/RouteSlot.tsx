"use client";

import type { ReactNode } from "react";

/**
 * Holds the current page inside the root layout's <main>. Keep it: it is a hydration fix, not decoration.
 *
 * The page reaches the browser as a lazy React Server Components chunk. If its JavaScript is still
 * loading when hydration reaches <main> (the first page load the service worker serves makes this
 * likely), and <main>'s direct child is that lazy chunk, React suspends while hydrating <main>
 * itself. When the chunk arrives React replays <main> from the start and tries to claim the <main>
 * element a second time, then fails with "Hydration failed" (React error #418) and client-renders
 * the page. With this component in between, React suspends here, <main> is claimed only once, and
 * nothing mismatches.
 *
 * Not a Suspense boundary: a boundary above the page would send notFound() pages as 200, not 404.
 */
export function RouteSlot({ children }: { children: ReactNode }) {
  return children;
}
