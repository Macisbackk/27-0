"use client";

import { getPlayoffRoundLabel } from "@/lib/game/playoff-bracket";
import type { PlayoffBracketState } from "@/lib/game/playoff-bracket";
import {
  MobileList,
  MobileListRow,
  MobileSection,
} from "@/components/mobile/MobileKit";

export function MobilePlayoffJourney({
  playoffs,
  title = "Playoffs",
}: {
  playoffs: PlayoffBracketState;
  title?: string;
}) {
  const rounds = [1, 2, 3] as const;
  const champion = playoffs.matches.find(
    (m) => m.round === 3 && m.status === "complete"
  )?.winner;

  return (
    <MobileSection label={title}>
      <MobileList>
        {rounds.map((round) => {
          const matches = playoffs.matches.filter((m) => m.round === round);
          const userMatch = matches.find((m) => m.isUserMatch) ?? matches[0];
          if (!userMatch) return null;
          const home = userMatch.homeTeam ?? "Winner";
          const away = userMatch.awayTeam ?? "Winner";
          const secondary =
            userMatch.status === "complete" &&
            userMatch.homeScore != null &&
            userMatch.awayScore != null
              ? `${userMatch.homeScore}–${userMatch.awayScore}`
              : userMatch.status === "ready"
                ? "Ready"
                : "Upcoming";
          return (
            <MobileListRow
              key={round}
              primary={getPlayoffRoundLabel(round)}
              secondary={`${home} vs ${away} · ${secondary}`}
              value={
                userMatch.isUserMatch && userMatch.status === "ready"
                  ? "Play"
                  : userMatch.winner ?? undefined
              }
              selected={userMatch.isUserMatch && userMatch.status === "ready"}
            />
          );
        })}
        {champion ? (
          <MobileListRow primary="Champion" value={champion} selected />
        ) : null}
      </MobileList>
    </MobileSection>
  );
}
