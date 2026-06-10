"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatsPanel } from "@/components/StatsPanel";
import { useAuth } from "@/lib/auth-context";
import { getAllStats } from "@/lib/storage/stats";
import { importLocalStatsToCloud } from "@/lib/storage/stats-cloud";
import { BTN, CARD, LINK, SPACING } from "@/lib/ui/design-system";
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
        ? "Local stats imported to your online account."
        : (result.error ?? "Import failed.")
    );
    setImporting(false);
  };

  return (
    <div className={`mx-auto max-w-4xl ${SPACING.pageX} py-8`}>
      <h1 className={`mb-2 ${TYPO.pageTitle}`}>{title}</h1>

      {!loading && !isLoggedIn && (
        <div className={`${CARD.panel} mb-6 ${SPACING.cardPadding} ${TYPO.body}`}>
          <p>Log in to save your statistics online.</p>
          <Link href="/" className={`mt-2 inline-block ${LINK.accent}`}>
            Go to Home to log in →
          </Link>
        </div>
      )}

      {isLoggedIn && (
        <div className={`mb-6 flex flex-wrap items-center ${SPACING.buttonGap}`}>
          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImport()}
            className={`${BTN.base} ${BTN.secondary} !min-h-[40px] text-[10px]`}
          >
            Import local stats to account
          </button>
          {importMsg && <p className={TYPO.body}>{importMsg}</p>}
        </div>
      )}

      <p className={`mb-6 ${TYPO.bodySm}`}>
        {isLoggedIn
          ? "Career statistics synced to your account when logged in."
          : "Career statistics on this device (local only until you log in)."}
      </p>
      <StatsPanel />
    </div>
  );
}
