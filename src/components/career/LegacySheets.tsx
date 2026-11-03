"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { DIVISION_LABEL, POS_LABEL, TROPHY_LABEL, awardLabel, formatMoney, legendAtClub, legendAsPlayer, legendCatalog, ordinal, totalMajorTrophies, type TrophyId } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playAchievementUnlock, playWarning } from "@/lib/sound";
import { Eyebrow, RatingPill } from "./bits";
import { ManagerSheet } from "./Sheet";
import { windowStatus } from "@/lib/career/midseason";

export function LegendVaultSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { legacy, unlockLegend, state } = useCareer();
  const [message, setMessage] = useState<string | null>(null);
  const legends = legendCatalog();

  return (
    <ManagerSheet
      list
      open={open}
      onClose={() => {
        setMessage(null);
        onClose();
      }}
      eyebrow="Legacy · every career"
      title="Legend Vault"
      headerExtra={
        <p className="mt-1.5 text-center">
          <span className="rounded-full bg-accent-gold/15 px-2.5 py-0.5 text-[13px] font-bold tabular-nums text-accent-gold">{legacy.legacyPoints} Legacy pts</span>
        </p>
      }
    >
      {/* The unlock message takes the intro's place (same room), so the list never jumps. */}
      <p
        className={`flex min-h-[3.75rem] items-center justify-center text-center text-[13px] leading-snug ${message ? "font-semibold text-theme-primary" : "text-gray-300"}`}
        role="status"
      >
        {message ?? "Earn points from trophies and challenges. Unlocked legends join your market in every career."}
      </p>
      <ul className="mt-1 divide-y divide-pitch-800">
        {legends.map((l) => {
          const owned = legacy.unlockedLegends.includes(l.id);
          const affordable = legacy.legacyPoints >= l.unlockCost;
          return (
            <li key={l.id} className="flex items-start gap-3 py-2.5 text-left">
              <span className="pt-0.5">
                <RatingPill rating={l.peak} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">
                  {l.name}
                  {l.tier === "great" ? (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-accent-gold">Great</span>
                  ) : null}
                </span>
                <span className="block text-[11px] leading-snug text-gray-400">
                  {POS_LABEL[l.pos]} · {l.club} · plays at {legendAsPlayer(l).rating} · signing fee {formatMoney(l.signingFee)}
                  {(() => {
                    if (!state) return null;
                    const at = legendAtClub(state, `legend-${l.id}`);
                    if (at && at !== state.userClubId) return <span className="block text-amber-300">At {state.clubs[at]?.name} this season</span>;
                    if ((state.retiredLegends ?? []).includes(`legend-${l.id}`)) return <span className="block text-gray-500">Retired in this career</span>;
                    return null;
                  })()}
                </span>
                <span className="mt-1.5 flex">
                {owned ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-success">Unlocked</span>
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
                        setMessage(
                          state && windowStatus(state).open
                            ? `${l.name} unlocked! Sign him in the market now. He'll go straight into your XIII.`
                            : `${l.name} unlocked! He'll be in the market when the window opens (pre-season or Deadline Day).`
                        );
                      }
                    }}
                  >
                    Unlock · {l.unlockCost} pts
                  </GameButton>
                )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </ManagerSheet>
  );
}

const TROPHY_ORDER: TrophyId[] = [
  "grand-final",
  "league-leaders",
  "challenge-cup",
  "championship-title",
  "million-pound-game",
  "nrl-premiership",
  "minor-premiership",
  "world-club-challenge",
  "promotion",
  "perfect-season",
];

export function RecordsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { legacy, state } = useCareer();
  return (
    <ManagerSheet list open={open} onClose={onClose} eyebrow="All careers" title="Records & trophies">
      <dl className="grid grid-cols-2 gap-3 text-center text-sm">
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
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">Best season</dt>
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
          <li key={t} className="flex items-center justify-between gap-2 rounded-control bg-pitch-800 px-3 py-2">
            <span className="min-w-0 text-left text-[13px] leading-tight text-gray-300">{TROPHY_LABEL[t]}</span>
            <span className="shrink-0 font-display font-bold tabular-nums text-white">{legacy.trophies[t] ?? 0}</span>
          </li>
        ))}
      </ul>

      {state && state.history.length ? (
        <>
          <div className="mt-5 text-center"><Eyebrow>This career · {state.clubs[state.userClubId]?.name}</Eyebrow></div>
          <ul className="mt-2 divide-y divide-pitch-800 text-sm">
            {[...state.history].reverse().map((h) => (
              <li key={h.year} className="flex items-center justify-between gap-2 py-2">
                <span className="text-gray-300">{h.year}</span>
                <span className="flex-1 text-gray-400">{DIVISION_LABEL[h.division]} · {ordinal(h.position)} · {h.won}–{h.lost}</span>
                <span className="text-right text-xs text-accent-gold">{h.trophies.filter((t) => t !== "promotion").map((t) => TROPHY_LABEL[t]).join(", ")}</span>
              </li>
            ))}
          </ul>
          {state.history.some((h) => h.awards?.length) ? (
            <section aria-label="Past award winners" data-testid="records-awards">
              <div className="mt-5 text-center"><Eyebrow>Awards · past winners</Eyebrow></div>
              <ul className="mt-2 space-y-1.5">
                {[...state.history]
                  .reverse()
                  .filter((h) => h.awards?.length)
                  .map((h, i) => (
                    <li key={h.year} className="rounded-control bg-pitch-800 px-3 py-2">
                      <details open={i === 0}>
                        <summary className="cursor-pointer text-sm font-semibold text-white">
                          {h.year} · {h.division === "nrl" ? "Dally M" : "Man of Steel"}{" "}
                          {h.awards!.find((a) => a.id === "man-of-steel" && a.division === (h.division === "nrl" ? "nrl" : "super-league"))?.name ?? "—"}
                        </summary>
                        <ul className="mt-1.5 space-y-1 text-[13px]">
                          {h.awards!.map((a) => (
                            <li key={`${a.id}-${a.division}`} className="text-gray-300">
                              <span className="text-gray-500">{awardLabel(a)}:</span>{" "}
                              <span className={a.clubId === state.userClubId ? "font-semibold text-accent-gold" : "text-white"}>{a.name}</span>
                              {a.id === "club-player" ? "" : ` (${a.clubName})`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </ManagerSheet>
  );
}
