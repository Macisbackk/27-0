"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";
import { DIVISION_LABEL, POS_LABEL, TROPHY_LABEL, formatMoney, legendCatalog, ordinal, totalMajorTrophies, type TrophyId } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playAchievementUnlock, playWarning } from "@/lib/sound";
import { Eyebrow, RatingPill } from "./bits";

export function LegendVaultSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { legacy, unlockLegend } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const legends = legendCatalog();

  return (
    <MobileBottomSheet
      open={open}
      onClose={() => {
        setMessage(null);
        onClose();
      }}
      title="Legend Vault"
      headerExtra={<span className="font-display text-lg font-bold text-accent-gold">{legacy.legacyPoints} LP</span>}
    >
      <p className="text-sm text-gray-300">
        Spend Legacy points (earned from trophies and challenges in any career). Unlocked legends turn up in your transfer window in
        <span className="font-semibold text-white"> every </span>career, and they'll join any club.
      </p>
      {message ? <p className="mt-2 text-sm text-theme-primary" role="status">{message}</p> : null}
      <ul className="mt-3 divide-y divide-pitch-800">
        {legends.map((l) => {
          const owned = legacy.unlockedLegends.includes(l.id);
          const affordable = legacy.legacyPoints >= l.unlockCost;
          return (
            <li key={l.id} className="flex items-center gap-3 py-2.5">
              <RatingPill rating={l.peak} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">{l.name}</span>
                <span className="text-[11px] text-gray-400">
                  {POS_LABEL[l.pos]} · {l.club} · signs for {formatMoney(l.signingFee)}
                </span>
              </span>
              {owned ? (
                <span className="text-xs font-bold uppercase tracking-wide text-success">Unlocked</span>
              ) : (
                <GameButton
                  size="sm"
                  fullWidth={false}
                  variant={affordable ? "era" : "secondary"}
                  disabled={!affordable}
                  onClick={() => {
                    const err = unlockLegend(l.id);
                    if (err) {
                      playWarning();
                      setMessage(err === "points" ? "Not enough Legacy points yet." : "Couldn't unlock that legend.");
                    } else {
                      playAchievementUnlock();
                      setMessage(`${l.name} unlocked! Look for him in your next transfer window.`);
                    }
                  }}
                >
                  {l.unlockCost} LP
                </GameButton>
              )}
            </li>
          );
        })}
      </ul>
    </MobileBottomSheet>
  );
}

const TROPHY_ORDER: TrophyId[] = ["grand-final", "league-leaders", "challenge-cup", "championship-title", "million-pound-game", "promotion", "perfect-season"];

export function RecordsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { legacy, state } = useCareer();
  return (
    <MobileBottomSheet open={open} onClose={onClose} title="Records & trophy cabinet">
      <Eyebrow>All careers</Eyebrow>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Major trophies</dt>
          <dd className="font-display text-xl font-bold text-accent-gold">{totalMajorTrophies(legacy)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Careers</dt>
          <dd className="font-display text-xl font-bold text-white">{legacy.careersStarted}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Fastest to glory</dt>
          <dd className="text-white">{legacy.fastestGlorySeasons ? `${legacy.fastestGlorySeasons} seasons` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Best SL season</dt>
          <dd className="text-white">{legacy.bestSeason ? `${legacy.bestSeason.wins}–${legacy.bestSeason.losses} (${legacy.bestSeason.year})` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Biggest win</dt>
          <dd className="text-white">{legacy.biggestWin ? `${legacy.biggestWin.score} v ${legacy.biggestWin.opponent}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Perfect seasons</dt>
          <dd className="text-white">{legacy.perfectSeasons}</dd>
        </div>
      </dl>

      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {TROPHY_ORDER.map((t) => (
          <li key={t} className="flex items-center justify-between rounded-lg bg-pitch-800 px-3 py-2">
            <span className="text-gray-300">{TROPHY_LABEL[t]}</span>
            <span className="font-display font-bold text-white">{legacy.trophies[t]}</span>
          </li>
        ))}
      </ul>

      {state && state.history.length ? (
        <>
          <div className="mt-5"><Eyebrow>This career · {state.clubs[state.userClubId]?.name}</Eyebrow></div>
          <ul className="mt-2 divide-y divide-pitch-800 text-sm">
            {[...state.history].reverse().map((h) => (
              <li key={h.year} className="flex items-center justify-between gap-2 py-2">
                <span className="text-gray-300">{h.year}</span>
                <span className="flex-1 text-gray-400">{DIVISION_LABEL[h.division]} · {ordinal(h.position)} · {h.won}–{h.lost}</span>
                <span className="text-right text-xs text-accent-gold">{h.trophies.filter((t) => t !== "promotion").map((t) => TROPHY_LABEL[t]).join(", ")}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </MobileBottomSheet>
  );
}
