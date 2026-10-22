import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayPageClient } from "./PlayPageClient";

export const metadata: Metadata = {
  title: "Classic — 27-0",
  description: "Spin real 2026 or historic Super League squads, build a 13 and chase 27-0.",
};

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
