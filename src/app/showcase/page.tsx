import { Suspense } from "react";
import { PlayerShowcase } from "@/components/PlayerShowcase";
import { PlayerRegistryGate } from "@/components/PlayerRegistryGate";

export default function ShowcasePage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <PlayerRegistryGate>
          <Suspense fallback={<p className="text-pitch-400">Loading showcase…</p>}>
            <PlayerShowcase />
          </Suspense>
        </PlayerRegistryGate>
      </div>
    </div>
  );
}
