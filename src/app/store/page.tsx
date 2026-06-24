"use client";

import { StorePanel } from "@/components/StorePanel";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function StorePage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className={`relative mx-auto max-w-3xl ${SPACING.pageX} py-10 sm:py-14`}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Club Shop</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
            Store
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            Unlock team colour themes with your club funds.
          </p>
        </header>

        <div className="mt-8">
          <StorePanel />
        </div>
      </div>
    </div>
  );
}
