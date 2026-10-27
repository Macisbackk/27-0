"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  DAILY_ARCHIVE_DAYS,
  formatDailyArchiveDate,
  getDailyArchiveDateKeys,
  getDailyArchiveHref,
  getDailyArchiveScenario,
} from "@/lib/daily-archive";
import { getDailyChallengeHref, getDailyChallengeResultForKey } from "@/lib/daily-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { MODES_PAGE } from "@/lib/play-side-modes";
import { playUiClick } from "@/lib/sound";
import { PitchHero } from "@/components/ui/PitchHero";
import { FixtureGlyph } from "@/components/icons/rugby-icons";

interface ArchiveRow {
  key: string;
  date: string;
  title: string;
  summary: string;
  era: boolean;
  href: string;
  /** Your counted score that day, if you played it. */
  score: number | null;
}

/** Past Dailies — the last 30 Dailies to replay as practice (same rule, same spins). */
export default function PastDailiesPage() {
  const [rows, setRows] = useState<ArchiveRow[] | null>(null);

  useEffect(() => {
    try {
      setRows(
        getDailyArchiveDateKeys().map((key) => {
          const scenario = getDailyArchiveScenario(key);
          return {
            key,
            date: formatDailyArchiveDate(key),
            title: scenario.ruleTitle,
            summary: scenario.ruleSummary,
            era: scenario.eraMode,
            href: getDailyArchiveHref(key),
            score: getDailyChallengeResultForKey(key)?.score ?? null,
          };
        })
      );
    } catch {
      setRows([]);
    }
  }, []);

  return (
    <StandardPageShell>
      <div className={`${PAGE.section} mx-auto w-full max-w-[44rem]`}>
        <header className="space-y-3">
          <PitchHero
            eyebrow={
              <span>
                <Link href={MODES_PAGE} className="underline-offset-2 hover:underline">More modes</Link> · Practice
              </span>
            }
            title="Past Dailies"
            icon={<FixtureGlyph />}
          />
          <p className="text-left text-sm text-[color:var(--fl-muted)] px-1">
            The last {DAILY_ARCHIVE_DAYS} days: same rule, same spins, same season as on the day. Practice only: no
            streak, Daily board, missions or Club Funds.
          </p>
          {SHOW_DAILY_CHALLENGE_UI ? (
            <Link href={getDailyChallengeHref()} onClick={() => playUiClick()} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-theme-primary">
              Today&apos;s Daily is on the home screen ›
            </Link>
          ) : null}
        </header>

        {rows === null ? (
          <p className={`text-center ${TYPO.meta}`}>Loading…</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key}>
                <Link
                  href={row.href}
                  onClick={() => playUiClick()}
                  className="btn-press flex min-h-[60px] items-center gap-3 rounded-card bg-pitch-900 px-3 py-2.5 text-left text-white hover:bg-pitch-800"
                >
                  <span className="w-[76px] shrink-0 text-xs font-bold text-[color:var(--fl-muted)]">{row.date}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">
                      {row.title}
                      {row.era ? <span className="ml-1.5 text-xs font-semibold text-accent-gold">Era</span> : null}
                    </span>
                    <span className="block truncate text-xs text-[color:var(--fl-muted)]">{row.summary}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-bold">
                    {row.score !== null ? (
                      <span className="text-theme-primary">You: {row.score}</span>
                    ) : (
                      <span className="text-[color:var(--fl-muted)]">Play ›</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StandardPageShell>
  );
}
