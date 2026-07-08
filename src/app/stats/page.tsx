"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatsPanel } from "@/components/StatsPanel";
import { PageShell, PageShellBody } from "@/components/ui/PageShell";
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

  const title = coachName ? `${coachName}'s Stats` : "Your Stats";

  const handleImport = async () => {
    setImporting(true);
    setImportMsg(null);
    const result = await importLocalStatsToCloud(getAllStats());
    setImportMsg(
      result.ok
        ? "Stats synced to your account without double-counting."
        : (result.error ?? "Import failed.")
    );
    setImporting(false);
  };

  return (
    <PageShell withLights compact desktopFit>
      <PageShellBody>
      <div className={PAGE.section}>
        <header>
          <p className={TYPO.sectionLabel}>Career</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>{title}</h1>
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
              Import local stats to account
            </button>
            {importMsg && <p className={TYPO.body}>{importMsg}</p>}
          </div>
        )}

        <p className={TYPO.bodySm}>
          {isLoggedIn
            ? "Career statistics synced to your account when logged in."
            : "Career statistics on this device (local only until you log in)."}
        </p>

        <StatsPanel />
      </div>
      </PageShellBody>
    </PageShell>
  );
}
