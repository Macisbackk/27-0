"use client";

import { StorePanel } from "@/components/StorePanel";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { PitchHero } from "@/components/ui/PitchHero";
import { ShopGlyph } from "@/components/icons/rugby-icons";

export default function StorePage() {
  return (
    <StandardPageShell>
      <div className={PAGE.section}>
        <header className="space-y-3">
          <PitchHero eyebrow="Club Funds" title="Store" icon={<ShopGlyph />} />
          <p className="text-left text-sm text-[color:var(--fl-muted)] px-1">
            Starter titles, pitches and a frame from £50k, then themes, your own kit, more pitch styles, coach titles, leaderboard frames and Ball Knower mode.
          </p>
        </header>
        <StorePanel />
      </div>
    </StandardPageShell>
  );
}
