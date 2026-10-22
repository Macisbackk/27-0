"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileModal } from "@/components/ui/MobileOverlay";
import { formatMoney, prestigeRatingCap } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { Card, Eyebrow, ProgressBar, Stars } from "./bits";
import { TransferRoundUp } from "./TransferNews";

export function ClubTab({ onOpenVault, onOpenRecords }: { onOpenVault: () => void; onOpenRecords: () => void }) {
  const { state, legacy, abandonCareer } = useCareer();
  const [confirm, setConfirm] = useState(false);
  const s = state!;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>Season challenges</Eyebrow>
        <p className="mt-1 text-xs text-gray-400">Optional goals. Hit them for cash and Legacy points.</p>
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
                {!lowerBetter ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={c.done ? c.target : Math.min(c.progress, c.target)} max={c.target} tone={c.done ? "gold" : "theme"} />
                    <span className="w-14 text-right text-[11px] tabular-nums text-gray-400">
                      {Math.min(c.progress, c.target)}/{c.target}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-500">Settled at the end of the season.</p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

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
          Prestige grows with trophies and promotion. It brings more income and better signings: players rated up to{" "}
          <span className="font-semibold text-white">{prestigeRatingCap(s.prestige)}</span> will join you now. The transfer window opens after the season.
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
          <GameButton size="sm" variant="secondary" fullWidth={false} onClick={onOpenVault}>Legend Vault</GameButton>
          <GameButton size="sm" variant="secondary" fullWidth={false} onClick={onOpenRecords}>Records</GameButton>
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
        <button type="button" onClick={() => setConfirm(true)} className="text-xs text-gray-500 underline-offset-2 hover:text-danger hover:underline">
          Start a new career
        </button>
      </div>

      <MobileModal open={confirm} onClose={() => setConfirm(false)} title="Start a new career?">
        <p className="text-sm text-gray-300">
          This career ends for good. Your Legacy points, unlocked legends, trophies and records are kept.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <GameButton variant="secondary" onClick={() => setConfirm(false)}>Keep playing</GameButton>
          <GameButton variant="danger" onClick={() => { setConfirm(false); abandonCareer(); }}>End career</GameButton>
        </div>
      </MobileModal>
    </div>
  );
}
