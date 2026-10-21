import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayerShowcase } from "@/components/PlayerShowcase";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Player Showcase — 27-0",
  description: "Browse current and historic rugby league player cards and ratings.",
};

export default function ShowcasePage() {
  return (
    <StandardPageShell>
      <Suspense fallback={<p className="text-pitch-400">Loading showcase…</p>}>
        <PlayerShowcase />
      </Suspense>
    </StandardPageShell>
  );
}
