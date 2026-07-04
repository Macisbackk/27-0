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
  /** Gold styling for Challenge Cup results. */
  cupHighlight?: boolean;
}

export function FixtureResultRow({
  fixture,
  showRound = true,
  compact,
  onClick,
  selected,
  roundLabel,
  userTeamName = DREAM_TEAM_NAME,
  cupHighlight,
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
      className={`fixture-result-row min-w-0 w-full max-w-full text-left transition ${
        selected
          ? "fixture-result-row--selected border-accent-green/50 bg-accent-green/10"
          : cupHighlight
            ? `${CARD.base} border-2 border-accent-gold/50 bg-accent-gold/10 ring-1 ring-accent-gold/25`
            : `${CARD.base} bg-pitch-900/40`
      } ${onClick ? CARD.interactive : ""} ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2 sm:px-3 sm:py-2.5"
      }`}
    >
      {showRound && (
        <p
          className={`mb-1.5 line-clamp-2 px-0.5 text-center text-[10px] leading-snug sm:mb-2 sm:px-0 sm:text-inherit ${TYPO.statLabel}`}
        >
          {roundLabel ?? `Round ${fixture.round}`}
          {!compact && !roundLabel && (
            <span className="ml-1.5 text-gray-600 sm:ml-2">
              · {fixture.isHome ? "Home" : "Away"}
            </span>
          )}
        </p>
      )}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-3">
        <ClubColorChip
          name={homeName}
          primary={homeColors.primary}
          secondary={homeColors.secondary}
          accent={"accent" in homeColors ? (homeColors as { accent?: string }).accent : undefined}
          compact
          align="left"
          surface={selected ? "resultRowSelected" : "resultRow"}
        />
        <div className="flex min-w-[3.25rem] flex-col items-center justify-center gap-0.5 px-0.5 sm:min-w-[4.75rem] sm:gap-1 sm:px-1">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black sm:h-7 sm:w-7 sm:text-xs ${
              fixture.result === "W"
                ? "bg-accent-green/25 text-accent-green"
                : "bg-red-500/25 text-red-400"
            }`}
          >
            {fixture.result}
          </span>
          <p className="fixture-score whitespace-nowrap font-display text-xs font-black leading-none text-white sm:text-sm">
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
