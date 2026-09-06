"use client";

import {
  MobileList,
  MobileListRow,
  MobileSection,
} from "@/components/mobile/MobileKit";
import type { ManagerCareer } from "@/lib/manager/types";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { getFullPositionName } from "@/lib/positions";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import type { MatchdaySlotTarget } from "@/lib/manager/managerMatchdaySquad";
import { playUiClick } from "@/lib/sound";

export function MobileSquadRoster({
  career,
  selectedTarget,
  pendingAssignId,
  replaceSourcePlayerId,
  onSlotClick,
  onPlayerClick,
}: {
  career: ManagerCareer;
  selectedTarget: MatchdaySlotTarget | null;
  pendingAssignId: string | null;
  replaceSourcePlayerId: string | null;
  onSlotClick: (target: MatchdaySlotTarget) => void;
  onPlayerClick: (playerId: string) => void;
}) {
  const handleRow = (target: MatchdaySlotTarget, playerId: string) => {
    playUiClick();
    if (pendingAssignId) {
      onSlotClick(target);
      return;
    }
    if (playerId) onPlayerClick(playerId);
    else onSlotClick(target);
  };

  return (
    <>
      <MobileSection label="First team">
        <MobileList>
          {career.xiiiSlotPositions.map((position, index) => {
            const playerId = career.matchdayXiii[index] ?? "";
            const player = playerId ? getManagerPlayer(career, playerId) : null;
            const ps = playerId
              ? career.squad.find((p) => p.playerId === playerId)
              : null;
            const unavailable = ps ? isPlayerUnavailable(ps) : false;
            const selected =
              (selectedTarget?.kind === "xiii" &&
                selectedTarget.index === index) ||
              replaceSourcePlayerId === playerId;
            const secondary = [
              getFullPositionName(position),
              unavailable ? "Unavailable" : "First team",
            ].join(" · ");
            return (
              <MobileListRow
                key={`xiii-${index}`}
                index={index + 1}
                primary={player?.name ?? "Empty"}
                secondary={secondary}
                value={player?.peakRating}
                selected={selected}
                onClick={() => handleRow({ kind: "xiii", index }, playerId)}
              />
            );
          })}
        </MobileList>
      </MobileSection>

      <MobileSection label="Interchange">
        <MobileList>
          {Array.from({ length: 4 }, (_, i) => {
            const playerId = career.matchdayInterchange[i] ?? "";
            const player = playerId ? getManagerPlayer(career, playerId) : null;
            const ps = playerId
              ? career.squad.find((p) => p.playerId === playerId)
              : null;
            const unavailable = ps ? isPlayerUnavailable(ps) : false;
            const selected =
              (selectedTarget?.kind === "bench" &&
                selectedTarget.index === i) ||
              replaceSourcePlayerId === playerId;
            return (
              <MobileListRow
                key={`bench-${i}`}
                index={14 + i}
                primary={player?.name ?? "Empty"}
                secondary={
                  player
                    ? `${getFullPositionName(player.position)} · ${unavailable ? "Unavailable" : "Interchange"}`
                    : "Empty bench"
                }
                value={player?.peakRating}
                selected={selected}
                onClick={() => handleRow({ kind: "bench", index: i }, playerId)}
              />
            );
          })}
        </MobileList>
      </MobileSection>
    </>
  );
}
