"use client";

import type { MatchFixture } from "@/lib/game/season-simulation";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { getClubColors } from "@/lib/clubs";
import { DREAM_TEAM_COLORS } from "@/lib/clubs/dream-team";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ClubColorChip } from "./ClubColorChip";

interface FixtureResultRowProps {
  fixture: MatchFixture;
  showRound?: boolean;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  /** Override for the round / competition line above the score. */
  roundLabel?: string;
  /** User's team name — defaults to Dream Team for season mode. */
  userTeamName?: string;
}

export function FixtureResultRow({
  fixture,
  showRound = true,
  compact,
  onClick,
  selected,
  roundLabel,
  userTeamName = DREAM_TEAM_NAME,
}: FixtureResultRowProps) {
  const opponentColors = getClubColors(fixture.opponent);
  const userColors =
    userTeamName === DREAM_TEAM_NAME
      ? DREAM_TEAM_COLORS
      : getClubColors(userTeamName);

  const homeName = fixture.isHome ? userTeamName : fixture.opponent;
  const awayName = fixture.isHome ? fixture.opponent : userTeamName;
  const homeColors = fixture.isHome ? userColors : opponentColors;
  const awayColors = fixture.isHome ? opponentColors : userColors;
  const homeScore = fixture.isHome ? fixture.pointsFor : fixture.pointsAgainst;
  const awayScore = fixture.isHome ? fixture.pointsAgainst : fixture.pointsFor;

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`fixture-result-row w-full text-left transition ${
        selected
          ? "fixture-result-row--selected border-accent-green/50 bg-accent-green/10"
          : `${CARD.base} bg-pitch-900/40`
      } ${onClick ? CARD.interactive : ""} ${
        compact ? "px-2 py-1.5" : "px-3 py-2.5"
      }`}
    >
      {showRound && (
        <p className={`mb-2 text-center ${TYPO.statLabel}`}>
          {roundLabel ?? `Round ${fixture.round}`}
          {!compact && !roundLabel && (
            <span className="ml-2 text-gray-600">
              · {fixture.isHome ? "Home" : "Away"}
            </span>
          )}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <ClubColorChip
          name={homeName}
          primary={homeColors.primary}
          secondary={homeColors.secondary}
          accent={"accent" in homeColors ? (homeColors as { accent?: string }).accent : undefined}
          compact
          align="left"
          surface={selected ? "resultRowSelected" : "resultRow"}
        />
        <div className="flex min-w-[76px] flex-col items-center justify-center gap-1 px-1">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
              fixture.result === "W"
                ? "bg-accent-green/25 text-accent-green"
                : "bg-red-500/25 text-red-400"
            }`}
          >
            {fixture.result}
          </span>
          <p className="fixture-score whitespace-nowrap font-display text-sm font-black leading-none text-white">
            {homeScore} - {awayScore}
          </p>
        </div>
        <ClubColorChip
          name={awayName}
          primary={awayColors.primary}
          secondary={awayColors.secondary}
          accent={"accent" in awayColors ? (awayColors as { accent?: string }).accent : undefined}
          compact
          align="right"
          surface={selected ? "resultRowSelected" : "resultRow"}
        />
      </div>
    </Wrapper>
  );
}
