import { Suspense } from "react";
import { PlayPageClient } from "./PlayPageClient";

/**
 * Play entry — query-param gating runs client-side so static export
 * (Capacitor Android) and the Vercel Node build both work.
 */
export default function PlayPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-pitch-400">Loading…</p>}>
      <PlayPageClient />
    </Suspense>
  );
}
