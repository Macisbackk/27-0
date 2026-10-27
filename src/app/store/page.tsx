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
          <p className={PAGE.intro}>
            Spend Club Funds on themes, kits and more.
          </p>
        </header>
        <StorePanel />
      </div>
    </StandardPageShell>
  );
}
