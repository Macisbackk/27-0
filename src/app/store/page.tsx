"use client";

import { StorePanel } from "@/components/StorePanel";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function StorePage() {
  return (
    <StandardPageShell>
      <div className={PAGE.section}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Club Shop</p>
          <h1 className={`mt-2 ${TYPO.pageTitle}`}>Store</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            Themes and boosts.
          </p>
        </header>
        <StorePanel />
      </div>
    </StandardPageShell>
  );
}
