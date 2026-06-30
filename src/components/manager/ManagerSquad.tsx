"use client";

import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { POSITION_SHORT, SQUAD_STRUCTURE } from "@/lib/positions";
import type { Position } from "@/lib/types";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer, getManagerPlayerEligiblePositions } from "@/lib/manager/managerPlayers";
import { getPlayerAge } from "@/lib/players/player-age";
import { formatValue } from "@/lib/players";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";

interface ManagerSquadProps {
  career: ManagerCareer;
}

const POSITION_ORDER: Position[] = SQUAD_STRUCTURE.map((s) => s.position).filter(
  (p, i, arr) => arr.indexOf(p) === i
);

export function ManagerSquad({ career }: ManagerSquadProps) {
  const byPosition = new Map<Position, typeof career.squad>();
  for (const pos of POSITION_ORDER) byPosition.set(pos, []);

  for (const ps of career.squad) {
    const player = getManagerPlayer(career, ps.playerId);
    if (!player) continue;
    const positions = getManagerPlayerEligiblePositions(career, ps.playerId);
    const primary = positions[0] ?? player.position;
    const list = byPosition.get(primary) ?? [];
    list.push(ps);
    byPosition.set(primary, list);
  }

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Squad</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Matchday squad · {career.squad.length} players
        </p>
      </div>

      <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
        <p className={TYPO.bodySm}>
          Spine, pack and interchange — manage your matchday 17 from the hub
          before each fixture.
        </p>
      </div>

      {POSITION_ORDER.map((pos) => {
        const players = byPosition.get(pos) ?? [];
        if (players.length === 0) return null;
        return (
          <section key={pos}>
            <h2 className={`${TYPO.sectionLabel} mb-2`}>
              {POSITION_SHORT[pos]} ·{" "}
              {pos === "PROP"
                ? "Forwards"
                : ["FULLBACK", "WING", "CENTRE", "STAND_OFF", "SCRUM_HALF"].includes(
                      pos
                    )
                  ? "Backs"
                  : "Pack"}
            </h2>
            <div className={`grid gap-2 sm:grid-cols-2`}>
              {players.map((ps) => {
                const player = getManagerPlayer(career, ps.playerId);
                if (!player) return null;
                const age = getPlayerAge(player);
                const inXiii = career.matchdayXiii.includes(ps.playerId);
                const onBench = career.matchdayInterchange.includes(ps.playerId);
                const unavailable = isPlayerUnavailable(ps);
                return (
                  <div
                    key={ps.playerId}
                    className={`${CARD.base} ${SPACING.cardPaddingSm} ${
                      inXiii ? "ring-1 ring-theme-tertiary/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate font-medium text-white`}>
                          {player.name}
                        </p>
                        <p className={`${TYPO.bodySm} text-pitch-400`}>
                          {POSITION_SHORT[pos]}
                          {age ? ` · ${age}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-theme-primary">
                        {player.rating ?? player.peakRating}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-pitch-300">
                      <span>Form {ps.form}</span>
                      <span>Fitness {ps.fitness}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-pitch-400">
                      <span>{formatValue(player.value)}</span>
                      <span>
                        {career.playerSeasonStats[ps.playerId]?.tries ??
                          ps.seasonTries}{" "}
                        tries /{" "}
                        {career.playerSeasonStats[ps.playerId]?.appearances ??
                          ps.seasonAppearances}{" "}
                        apps
                      </span>
                    </div>
                    {ps.injury && (
                      <p className="mt-1 text-[10px] text-red-300">
                        {formatInjuryLabel(ps.injury)}
                      </p>
                    )}
                    {(inXiii || onBench) && (
                      <p className="mt-1 text-[10px] text-theme-tertiary">
                        {inXiii ? "Starting XIII" : "Interchange"}
                      </p>
                    )}
                    {unavailable && (
                      <p className="mt-1 text-[10px] text-red-400">Unavailable</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
