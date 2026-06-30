"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { formatValue } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import {
  signPlayer,
  releasePlayer,
} from "@/lib/manager/managerTransfers";
import { playUiClick } from "@/lib/sound";

interface ManagerTransfersProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onBack: () => void;
}

export function ManagerTransfers({
  career,
  onUpdate,
  onBack,
}: ManagerTransfersProps) {
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [message, setMessage] = useState<string | null>(null);

  const marketPlayers = useMemo(() => {
    return career.transferMarket
      .map((id) => getPlayerById(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(p).includes(positionFilter);
      })
      .sort((a, b) => b.peakRating - a.peakRating);
  }, [career.transferMarket, positionFilter]);

  const handleSign = (playerId: string) => {
    const result = signPlayer(career, playerId);
    if (!result.ok) {
      setMessage(result.error ?? "Signing failed");
      return;
    }
    setMessage("Player signed!");
    onUpdate(result.career!);
  };

  const handleRelease = (playerId: string) => {
    onUpdate(releasePlayer(career, playerId));
    setMessage("Player released");
  };

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={TYPO.pageTitle}>Transfers</h1>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Budget: £{(career.budget / 1000).toFixed(0)}k
          </p>
        </div>
        <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onBack}>
          Hub
        </GameButton>
      </div>

      {message && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{message}</p>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-2`}>Filter by position</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`rounded-lg border px-2 py-1 text-xs ${
              positionFilter === "all" ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
            }`}
          >
            All
          </button>
          {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                positionFilter === pos ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </div>

      <section>
        <h2 className={`${TYPO.sectionLabel} mb-2`}>Available Players</h2>
        <div className={`grid gap-2 sm:grid-cols-2`}>
          {marketPlayers.map((player) => (
            <div
              key={player.id}
              className={`${CARD.base} ${SPACING.cardPaddingSm}`}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{player.name}</p>
                  <p className={`${TYPO.bodySm} text-pitch-400`}>
                    {player.club} · {player.peakRating} rated
                  </p>
                </div>
                <span className="text-sm text-accent-gold">
                  {formatValue(player.value)}
                </span>
              </div>
              <GameButton
                variant="theme"
                size="sm"
                className="mt-2"
                disabled={career.budget < player.value}
                onClick={() => {
                  playUiClick();
                  handleSign(player.id);
                }}
              >
                Sign
              </GameButton>
            </div>
          ))}
          {marketPlayers.length === 0 && (
            <p className={`${TYPO.bodySm} text-pitch-400`}>No players available</p>
          )}
        </div>
      </section>

      <section>
        <h2 className={`${TYPO.sectionLabel} mb-2`}>Release Player</h2>
        <div className={`${SPACING.stackSm}`}>
          {career.squad.slice(0, 8).map((ps) => {
            const player = getPlayerById(ps.playerId);
            if (!player) return null;
            return (
              <div
                key={ps.playerId}
                className={`${CARD.inset} flex items-center justify-between gap-2 px-3 py-2`}
              >
                <span className={`${TYPO.bodySm}`}>{player.name}</span>
                <GameButton
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  onClick={() => {
                    playUiClick();
                    handleRelease(ps.playerId);
                  }}
                >
                  Release
                </GameButton>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
