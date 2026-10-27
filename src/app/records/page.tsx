"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameTabs } from "@/components/ui/GameTabs";
import { ActionButton } from "@/components/ui/ActionButton";
import { PAGE, LINK } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useSquadBook } from "@/lib/squad-book";
import { getAllStats, refreshCareerStatsFromCloud } from "@/lib/storage/stats";
import { loadRunHistory, RUN_HISTORY_CHANGED_EVENT } from "@/lib/storage/run-history";
import { deriveRecords, formatWinPct, type RecordLine, type RecordsSummary, type RunHistoryEntry } from "@/lib/records";
import { formatSharePosition } from "@/lib/share-result";
import { PitchHero } from "@/components/ui/PitchHero";
import { CupGlyph } from "@/components/icons/rugby-icons";

const VARIANT_LABEL: Record<RunHistoryEntry["variant"], string> = {
  classic: "Classic",
  era: "Era Classic",
  daily: "Daily",
  weekly: "Weekly",
  ballKnower: "Ball Knower",
};

const FINISH_LABEL: Record<string, string> = {
  "Super League Champions": "Champions",
  "Grand Final Runner-Up": "Grand Final",
  "Eliminated in Semi-Final": "Semi-final",
  "Eliminated in Eliminator": "Eliminator",
  "Missed Play-Offs": "No play-offs",
};

type SquadTab = "result" | "rating";
const SQUAD_TABS: { id: SquadTab; label: string }[] = [
  { id: "result", label: "Best result" },
  { id: "rating", label: "Highest rated" },
];

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-tile bg-pitch-950/60 px-3 py-2.5 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--fl-muted)]">{label}</p>
      <p className="fl-number mt-0.5 text-[26px] leading-none text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[color:var(--fl-muted)]">{sub}</p> : null}
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left">
      <h2 className="text-[17px] font-bold text-white">{title}</h2>
      {intro ? <p className="mt-1 text-sm text-[color:var(--fl-muted)]">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function recordText(l: RecordLine): string {
  return `${l.wins}-${l.losses}`;
}

function RunSquad({ run }: { run: RunHistoryEntry }) {
  const finish = run.finish ? (FINISH_LABEL[run.finish] ?? run.finish) : null;
  return (
    <div>
      <p className="text-sm text-white">
        <span className="font-bold">
          {run.wins}-{run.losses}
        </span>{" "}
        · {formatSharePosition(run.position)}
        {finish ? ` · ${finish}` : ""}
        {run.perfect ? " · 27-0" : ""}
      </p>
      <p className="text-xs text-[color:var(--fl-muted)]">
        {VARIANT_LABEL[run.variant]} · average rating {run.rating.toFixed(1)}
        {run.at ? ` · ${new Date(run.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {[...run.squad]
          .sort((a, b) => a.slot - b.slot)
          .map((c) => (
            <li key={`${c.slot}-${c.id}`} className="flex min-w-0 items-center gap-2 rounded-tile bg-pitch-950/60 px-2.5 py-1.5 text-sm">
              <span className="w-9 shrink-0 text-xs font-bold text-[color:var(--fl-muted)]">{c.label}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-white">
                {c.name}
                <span className="font-normal text-[color:var(--fl-muted)]">
                  {" "}
                  · {c.club}
                  {c.year ? ` ${c.year}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-display font-bold tabular-nums text-[color:var(--rating)]">{c.rating}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function RecordsPage() {
  const book = useSquadBook();
  const [summary, setSummary] = useState<RecordsSummary | null>(null);
  const [tab, setTab] = useState<SquadTab>("result");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(RUN_HISTORY_CHANGED_EVENT, bump);
    window.addEventListener("stats-merged", bump);
    window.addEventListener("storage", bump);
    void refreshCareerStatsFromCloud().catch(() => false);
    return () => {
      window.removeEventListener(RUN_HISTORY_CHANGED_EVENT, bump);
      window.removeEventListener("stats-merged", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useEffect(() => {
    let stats: ReturnType<typeof getAllStats> | null = null;
    try {
      stats = getAllStats();
    } catch {
      stats = null;
    }
    setSummary(
      deriveRecords({
        stats: { normal: stats?.normal, eraNormal: stats?.eraNormal, hard: stats?.hard },
        history: loadRunHistory(),
        squadBook: book,
      })
    );
  }, [book, tick]);

  const run = useMemo(() => (tab === "result" ? summary?.bestRun : summary?.highestRatedRun) ?? null, [summary, tab]);
  const empty = summary !== null && summary.allTime.seasons === 0 && summary.runsTracked === 0 && summary.mostDrafted.length === 0;

  return (
    <StandardPageShell>
      <div className={PAGE.section}>
        <header className="space-y-3">
          <PitchHero eyebrow="Your history" title="Records" icon={<CupGlyph />} />
          <p className={PAGE.intro}>
            Your Classic, Era Classic and Ball Knower seasons.
          </p>
        </header>

        {!summary ? (
          <p className={`text-center ${TYPO.bodySm}`}>Loading your records…</p>
        ) : empty ? (
          <section className="rounded-card bg-pitch-900 p-5 text-center">
            <p className="text-white">No finished seasons yet.</p>
            <div className="mx-auto mt-3 max-w-xs">
              <ActionButton variant="theme" href="/play">
                Play a season
              </ActionButton>
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-3">
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Headline records">
              <Stat
                label="All-time"
                value={recordText(summary.allTime)}
                sub={`${formatWinPct(summary.allTime.wins, summary.allTime.losses)} · ${summary.allTime.seasons} season${summary.allTime.seasons === 1 ? "" : "s"}`}
              />
              <Stat
                label="Best season"
                value={summary.bestSeason ? `${summary.bestSeason.wins}-${summary.bestSeason.losses}` : "–"}
                sub="regular season"
              />
              <Stat label="Win streak" value={summary.longestWinStreak} sub="longest in a season" />
              <Stat label="27-0s" value={summary.perfectSeasons} sub={`${summary.titles} Grand Final${summary.titles === 1 ? "" : "s"} won`} />
            </section>

            <Section title="All-time record" intro="Daily runs don't count here.">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[color:var(--fl-muted)]">
                    <th scope="col" className="pb-1 font-semibold">Mode</th>
                    <th scope="col" className="pb-1 text-right font-semibold">Seasons</th>
                    <th scope="col" className="pb-1 text-right font-semibold">W-L</th>
                    <th scope="col" className="pb-1 text-right font-semibold">Play-offs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] tabular-nums">
                  {(
                    [
                      ["Classic", summary.byMode.classic],
                      ["Era Classic", summary.byMode.era],
                      ["Ball Knower", summary.byMode.ballKnower],
                    ] as const
                  ).map(([label, l]) => (
                    <tr key={label} className="text-white">
                      <th scope="row" className="py-1.5 text-left font-semibold">{label}</th>
                      <td className="py-1.5 text-right">{l.seasons}</td>
                      <td className="py-1.5 text-right">{recordText(l)}</td>
                      <td className="py-1.5 text-right">
                        {l.playoffWins}-{l.playoffLosses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[color:var(--fl-muted)]">
                League Leaders {summary.leagueLeaders} time{summary.leagueLeaders === 1 ? "" : "s"} · Grand Finals won {summary.titles}
              </p>
            </Section>

            <Section title="Best-ever squad">
              <div className="mb-3 flex justify-center">
                <GameTabs tabs={SQUAD_TABS} active={tab} onChange={setTab} ariaLabel="Best squad by" />
              </div>
              {run ? (
                <RunSquad run={run} />
              ) : (
                <p className={TYPO.bodySm}>Finish a season to see your best 13.</p>
              )}
            </Section>

            <Section title="Most drafted" intro="The cards you've fielded most.">
              {summary.mostDrafted.length === 0 ? (
                <p className={TYPO.bodySm}>
                  Nothing yet. <Link href="/play" className={LINK.accent}>Play a season</Link>
                </p>
              ) : (
                <ol className="grid gap-1 sm:grid-cols-2">
                  {summary.mostDrafted.map((p, i) => (
                    <li key={p.id} className="flex min-w-0 items-center gap-2 rounded-tile bg-pitch-950/60 px-2.5 py-1.5 text-sm">
                      <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-[color:var(--fl-muted)]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-white">
                        {p.name}
                        <span className="font-normal text-[color:var(--fl-muted)]">
                          {" "}
                          · {p.club}
                          {p.year ? ` ${p.year}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-300">×{p.times}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-2 text-xs">
                <Link href="/squad-book" className={LINK.accent}>
                  Open the Squad Book →
                </Link>
              </p>
            </Section>
          </div>
        )}
      </div>
    </StandardPageShell>
  );
}
