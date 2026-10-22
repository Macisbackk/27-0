"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatsPanel } from "@/components/StatsPanel";
import { PageShellBody } from "@/components/ui/PageShell";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { useAuth } from "@/lib/auth-context";
import { getAllStats } from "@/lib/storage/stats";
import { importLocalStatsToCloud } from "@/lib/storage/stats-cloud";
import { BTN, CARD, LINK, PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function StatsPage() {
  const { isLoggedIn, coachName, loading } = useAuth();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    setImportMsg(null);
  }, [isLoggedIn]);

  const eyebrow = coachName ? `Coach ${coachName}` : "Career";

  const handleImport = async () => {
    setImporting(true);
    setImportMsg(null);
    const result = await importLocalStatsToCloud(getAllStats());
    setImportMsg(
      result.ok
        ? "Stats imported to your account."
        : (result.error ?? "Import failed.")
    );
    setImporting(false);
  };

  return (
    <StandardPageShell desktopFit>
      <PageShellBody>
      <div className={PAGE.section}>
        <header>
          <p className={TYPO.sectionLabel}>{eyebrow}</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>Career Stats</h1>
        </header>

        {!loading && !isLoggedIn && (
          <div className={`${CARD.hero} ${CARD.featured} p-4 sm:p-6 ${TYPO.body}`}>
            <p>Log in to save your statistics online.</p>
            <Link href="/" className={`mt-2 inline-block ${LINK.accent}`}>
              Go to Home to log in →
            </Link>
          </div>
        )}

        {isLoggedIn && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleImport()}
              className={`${BTN.base} ${BTN.secondary} text-xs`}
            >
              Import device stats
            </button>
            {importMsg && <p className={TYPO.body}>{importMsg}</p>}
          </div>
        )}

        <p className={TYPO.bodySm}>
          {isLoggedIn ? "Synced to your account." : "Saved on this device."}
        </p>

        <StatsPanel />
      </div>
      </PageShellBody>
    </StandardPageShell>
  );
}
