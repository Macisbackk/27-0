import { PlayerShowcase } from "@/components/PlayerShowcase";

export default function ShowcasePage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <PlayerShowcase />
      </div>
    </div>
  );
}
