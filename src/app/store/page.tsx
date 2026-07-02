"use client";

import { StorePanel } from "@/components/StorePanel";
import { PageShell } from "@/components/ui/PageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function StorePage() {
  return (
    <PageShell width="default" withLights compact>
      <div className={PAGE.section}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Club Shop</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
            Store
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            Unlock team colour themes with your club funds.
          </p>
        </header>
        <StorePanel />
      </div>
    </PageShell>
  );
}
