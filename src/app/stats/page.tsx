"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatsPanel } from "@/components/StatsPanel";
import { useAuth } from "@/lib/auth-context";
import { getAllStats } from "@/lib/storage/stats";
import { importLocalStatsToCloud } from "@/lib/storage/stats-cloud";

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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>

      {!loading && !isLoggedIn && (
        <div className="matchday-panel mb-6 p-4 text-sm text-gray-400">
          <p>Log in to save your statistics online.</p>
          <Link
            href="/"
            className="mt-2 inline-block font-semibold text-accent-green hover:underline"
          >
            Go to Home to log in →
          </Link>
        </div>
      )}

      {isLoggedIn && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImport()}
            className="rounded-lg border border-pitch-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-300 transition hover:border-accent-green/50 hover:text-white disabled:opacity-50"
          >
            Import local stats to account
          </button>
          {importMsg && (
            <p className="text-sm text-gray-400">{importMsg}</p>
          )}
        </div>
      )}

      <p className="mb-6 text-sm text-gray-500">
        {isLoggedIn
          ? "Career statistics synced to your account when logged in."
          : "Career statistics on this device (local only until you log in)."}
      </p>
      <StatsPanel />
    </div>
  );
}
