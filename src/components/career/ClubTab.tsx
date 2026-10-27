"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileModal } from "@/components/ui/MobileOverlay";
import { TROPHY_LABEL, formatMoney, ordinal, prestigeRatingCap } from "@/lib/career";
import type { SeasonChallenge } from "@/lib/career/types";
import { useCareer } from "@/lib/career/context";
import { playUiClick, playWarning } from "@/lib/sound";
import { Card, Eyebrow, ProgressBar, Stars } from "./bits";
import { TransferRoundUp } from "./TransferNews";

/** "Best margin: 12 / 30" rather than a bare "12/30" for goals that track a best, not a count. */
function challengeProgressLabel(c: SeasonChallenge): string {
  const value = c.done ? Math.max(c.progress, c.target) : Math.min(c.progress, c.target);
  switch (c.kind) {
    case "big-win":
      return `Best margin: ${value} / ${c.target}`;
    case "unbeaten-run":
      return `Best run: ${value} / ${c.target}`;
    case "win-games":
      return `${value} / ${c.target} wins`;
    case "points-scored":
      return `${value} / ${c.target} pts`;
    case "academy-debuts":
      return `${value} / ${c.target} debuts`;
    case "cup-reach":
      return `Round ${value} / ${c.target}`;
    default:
      return `${value} / ${c.target}`;
  }
}

export function ClubTab({ onOpenVault, onOpenRecords }: { onOpenVault: () => void; onOpenRecords: () => void }) {
  const { state, legacy, abandonCareer } = useCareer();
  const [confirm, setConfirm] = useState(false);
  const s = state!;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>Season challenges</Eyebrow>
        <p className="mt-1 text-xs text-gray-400">Optional. Hit them for cash and Legacy points.</p>
        <ul className="mt-3 space-y-3">
          {s.challenges.map((c) => {
            const lowerBetter = c.kind === "finish-top";
            return (
              <li key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm ${c.done ? "text-success" : "text-white"}`}>
                    {c.done ? "✓ " : ""}
                    {c.title}
                  </p>
                  <p className="shrink-0 text-right text-[11px] text-gray-400">
                    {formatMoney(c.rewardCash)} · <span className="text-accent-gold">+{c.rewardLegacy} Legacy</span>
                  </p>
                </div>
                {lowerBetter ? (
                  <p className="mt-1 text-[11px] text-gray-500">Settled at the end of the season.</p>
                ) : c.target <= 1 || c.kind === "beat-club" ? (
                  // One-off goal: a tick, not a progress bar.
                  <p className={`mt-1 text-[11px] ${c.done ? "text-success" : "text-gray-400"}`}>
                    {c.done ? "Done" : "Not yet"}
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={c.done ? c.target : Math.min(c.progress, c.target)} max={c.target} tone={c.done ? "gold" : "theme"} />
                    <span className="shrink-0 text-right text-[11px] tabular-nums text-gray-400">
                      {challengeProgressLabel(c)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {s.history.length ? (
        <Card>
          <Eyebrow>Your career · {s.history.length} {s.history.length === 1 ? "season" : "seasons"}</Eyebrow>
          {(() => {
            const w = s.history.reduce((t, h) => t + h.won, 0);
            const l = s.history.reduce((t, h) => t + h.lost, 0);
            const trophies = s.history.flatMap((h) => h.trophies).filter((t) => t !== "promotion");
            const best = s.history.reduce((b, h) => (h.division === "super-league" && (!b || h.position < b.position) ? h : b), undefined as (typeof s.history)[number] | undefined);
            return (
              <>
                <p className="mt-1 text-sm text-gray-300">
                  <span className="font-display text-xl font-bold text-white">{w}W {l}L</span>
                  {best ? ` · best Super League finish ${ordinal(best.position)}` : ""}
                </p>
                {trophies.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {trophies.map((t, i) => (
                      <li key={`${t}-${i}`} className="rounded-full bg-accent-gold/15 px-2 py-0.5 text-[11px] font-semibold text-accent-gold">🏆 {TROPHY_LABEL[t]}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">No silverware yet.</p>
                )}
              </>
            );
          })()}
        </Card>
      ) : null}

      <Card>
        <Eyebrow>The club</Eyebrow>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Transfer budget</p>
            <p className={`font-display text-xl font-bold ${s.budget < 0 ? "text-danger" : "text-white"}`}>{formatMoney(s.budget)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Prestige</p>
            <p className="mt-1"><Stars value={s.prestige} label={`Prestige ${s.prestige} stars`} /></p>
          </div>
          {s.lastIncome != null ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Board income</p>
              <p className="text-gray-200">{formatMoney(s.lastIncome)} / season</p>
            </div>
          ) : null}
          {s.lastWages != null ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Wage bill</p>
              <p className="text-gray-200">{formatMoney(s.lastWages)} / season</p>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          Prestige rises with trophies and top-4 finishes. It falls with relegation or a bottom-3 finish.
          <br />
          It brings more income. Players rated up to <span className="font-semibold text-white">{prestigeRatingCap(s.prestige)}</span> will join you now.
        </p>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>Legacy · every career</Eyebrow>
          <p className="mt-1 text-sm text-gray-300">
            <span className="font-display text-xl font-bold text-accent-gold">{legacy.legacyPoints}</span> points to spend on legends
          </p>
        </div>
        <div className="flex gap-2">
          <GameButton size="sm" variant="secondary" fullWidth={false} onClick={() => { playUiClick(); onOpenVault(); }}>Legend Vault</GameButton>
          <GameButton size="sm" variant="secondary" fullWidth={false} onClick={() => { playUiClick(); onOpenRecords(); }}>Records</GameButton>
        </div>
      </Card>

      <TransferRoundUp />

      <Card>
        <Eyebrow>News</Eyebrow>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-300">
          {s.news.slice(0, 12).map((line, i) => (
            <li key={i} className={i === 0 ? "text-white" : ""}>{line}</li>
          ))}
        </ul>
      </Card>

      <div className="text-center">
        <button type="button" onClick={() => { playWarning(); setConfirm(true); }} className="text-xs text-gray-500 underline-offset-2 hover:text-danger hover:underline">
          Start a new career
        </button>
      </div>

      <MobileModal open={confirm} onClose={() => setConfirm(false)} title="Start a new career?">
        <p className="text-sm text-gray-300">
          This career ends for good. You keep Legacy points, legends, trophies and records.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <GameButton variant="secondary" onClick={() => setConfirm(false)}>Keep playing</GameButton>
          <GameButton variant="danger" onClick={() => { setConfirm(false); abandonCareer(); }}>End career</GameButton>
        </div>
      </MobileModal>
    </div>
  );
}
