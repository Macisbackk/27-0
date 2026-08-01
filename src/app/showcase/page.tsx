import { Suspense } from "react";
import { PlayerShowcase } from "@/components/PlayerShowcase";
import { PageShell } from "@/components/ui/PageShell";

export default function ShowcasePage() {
  return (
    <PageShell withLights compact>
      <Suspense fallback={<p className="text-pitch-400">Loading showcase…</p>}>
        <PlayerShowcase />
      </Suspense>
    </PageShell>
  );
}
