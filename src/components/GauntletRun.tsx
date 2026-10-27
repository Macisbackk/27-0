"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GAUNTLET_LENGTH, getGauntletOpponents, type GauntletResult } from "@/lib/game/gauntlet";
import type { GauntletRecord } from "@/lib/storage/mode-records";
import { MODES_PAGE } from "@/lib/play-side-modes";
import { GameButton } from "@/components/ui/GameButton";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface GauntletRunProps {
  result: GauntletResult;
  /** Era Classic draft (else Classic). */
  era: boolean;
  /** Personal best after this run, and whether this run set it. */
  record: GauntletRecord | null;
  newBest: boolean;
  onPlayAgain: () => void;
}

const STEP_MS = 900;

function verdict(beaten: number): string {
  if (beaten >= GAUNTLET_LENGTH) return `Clean sweep. ${GAUNTLET_LENGTH} great sides, ${GAUNTLET_LENGTH} wins.`;
  if (beaten >= 8) return "So close to immortality.";
  if (beaten >= 5) return "A proper run through the greats.";
  if (beaten >= 2) return "A couple of scalps, then the wall.";
  if (beaten === 1) return "One great side beaten.";
  return "Out at the first. The greats are great for a reason.";
}

/** The Gauntlet: ten great sides in a row, revealed one tie at a time. */
export function GauntletRun({ result, era, record, newBest, onPlayAgain }: GauntletRunProps) {
  const total = result.ties.length;
  const [shown, setShown] = useState(0);
  const done = shown >= total;

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 400 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, done]);

  // Sides never reached are listed too (greyed) so the whole ladder is visible.
  const ladder = getGauntletOpponents();

  return (
    <section className="space-y-3" aria-labelledby="gauntlet-title">
      <div className="text-center">
        <p className={`${TYPO.eyebrow} text-accent-gold`}>Gauntlet · {era ? "Era Classic" : "Classic"} draft</p>
        <h2 id="gauntlet-title" className="font-cond text-[26px] font-bold leading-tight text-white">
          {done ? `${result.beaten} of ${GAUNTLET_LENGTH} great sides beaten` : `${GAUNTLET_LENGTH} great sides. Lose once and you're out.`}
        </h2>
      </div>

      <ol className="space-y-1.5" aria-live="polite">
        {ladder.map((side, i) => {
          const tie = i < shown ? result.ties[i] : undefined;
          const unreached = i >= total;
          return (
            <li
              key={`${side.club}-${side.year}`}
              className={`${CARD.base} flex items-center gap-3 px-3 py-2 ${unreached && done ? "opacity-40" : ""}`}
            >
              <span className="w-6 shrink-0 text-center font-cond text-[17px] font-bold tabular-nums text-[color:var(--fl-muted)]">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-white">{side.label}</span>
                <span className="block truncate text-xs text-[color:var(--fl-muted)]">
                  Rated {side.squadRating.toFixed(1)} · {side.honour}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {tie ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                      tie.won ? "bg-theme-primary/20 text-theme-primary" : "bg-accent-red/20 text-red-300"
                    }`}
                  >
                    {tie.won ? "W" : "L"} {tie.pointsFor}-{tie.pointsAgainst}
                  </span>
                ) : unreached && done ? (
                  <span className="text-xs text-[color:var(--fl-muted)]">Not reached</span>
                ) : (
                  <span className="text-xs text-[color:var(--fl-muted)]">…</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {!done ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setShown(total);
            }}
            className="min-h-[44px] px-3 text-sm font-semibold text-[color:var(--fl-muted)] hover:text-white"
          >
            Skip to the result
          </button>
        </div>
      ) : (
        <div className={`${CARD.base} space-y-3 px-4 py-4 text-center`} role="status">
          <p className="text-[15px] font-bold text-white">{verdict(result.beaten)}</p>
          {record ? (
            <p className="text-sm text-[color:var(--fl-muted)]">
              {newBest ? "New personal best! " : ""}Best: {record.best}/{GAUNTLET_LENGTH}
              {record.sweeps > 0 ? ` · Clean sweeps: ${record.sweeps}` : ""} · Runs: {record.runs}
            </p>
          ) : null}
          <p className={TYPO.meta}>Unranked. No Club Funds.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <GameButton variant="theme" size="md" onClick={() => { playUiClick(); onPlayAgain(); }}>
              Draft again
            </GameButton>
            <Link
              href={MODES_PAGE}
              onClick={() => playUiClick()}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-control bg-pitch-800 px-4 text-sm font-bold text-white"
            >
              More modes
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

