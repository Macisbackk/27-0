import { Suspense } from "react";
import { PlayerShowcase } from "@/components/PlayerShowcase";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export default function ShowcasePage() {
  return (
    <StandardPageShell>
      <Suspense fallback={<p className="text-pitch-400">Loading showcase…</p>}>
        <PlayerShowcase />
      </Suspense>
    </StandardPageShell>
  );
}
