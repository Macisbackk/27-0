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
  const resultTone =
    fixture.result === "W"
      ? "bg-theme-primary/25 text-theme-primary"
      : fixture.result === "D"
        ? "bg-gray-500/25 text-gray-300"
        : "bg-red-500/25 text-red-400";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`fixture-result-row min-w-0 w-full max-w-full text-left transition ${
        selected
          ? "fixture-result-row--selected border border-theme-primary/35 bg-theme-primary/[0.08] shadow-[inset_2px_0_0_var(--theme-primary)]"
          : cupHighlight
            ? `${CARD.base} border-2 border-accent-gold/50 bg-accent-gold/10 ring-1 ring-accent-gold/25`
            : `${CARD.base} bg-pitch-900/40`
      } ${onClick ? CARD.interactive : ""} ${
        compact ? "px-1.5 py-1 sm:px-2 sm:py-1.5" : "px-2.5 py-2 sm:px-3 sm:py-2.5"
      }`}
    >
      {compact ? (
        <div className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-1.5">
          {showRound ? (
            <span
              className="text-center text-[9px] font-semibold tabular-nums leading-none text-pitch-500"
              title={roundLabel ?? `Round ${fixture.round}`}
            >
              {roundLabel ? roundLabel.replace(/^Round\s+/i, "R") : fixture.round}
            </span>
          ) : (
            <span aria-hidden />
          )}
          <ClubColorChip
            name={homeName}
            primary={homeColors.primary}
            secondary={homeColors.secondary}
            accent={
              "accent" in homeColors
                ? (homeColors as { accent?: string }).accent
                : undefined
            }
            compact
            showAccent={false}
            align="left"
            surface={selected ? "resultRowSelected" : "resultRow"}
          />
          <div className="flex shrink-0 items-center gap-1 px-0.5">
            <span
              className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-0.5 text-[8px] font-black ${resultTone}`}
            >
              {fixture.result}
            </span>
            <p className="fixture-score whitespace-nowrap font-display text-[11px] font-black leading-none text-white sm:text-xs">
              {homeScore}-{awayScore}
            </p>
          </div>
          <ClubColorChip
            name={awayName}
            primary={awayColors.primary}
            secondary={awayColors.secondary}
            accent={
              "accent" in awayColors
                ? (awayColors as { accent?: string }).accent
                : undefined
            }
            compact
            showAccent={false}
            align="right"
            surface={selected ? "resultRowSelected" : "resultRow"}
          />
        </div>
      ) : (
        <>
          {showRound && (
            <p
              className={`mb-1 line-clamp-2 px-0.5 text-center text-[10px] leading-snug sm:text-inherit ${TYPO.statLabel}`}
            >
              {roundLabel ?? `Round ${fixture.round}`}
              {!roundLabel && (
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
              accent={
                "accent" in homeColors
                  ? (homeColors as { accent?: string }).accent
                  : undefined
              }
              compact
              align="left"
              surface={selected ? "resultRowSelected" : "resultRow"}
            />
            <div className="flex min-w-[3.25rem] flex-col items-center justify-center gap-0.5 px-0.5 sm:min-w-[4.75rem] sm:px-1">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black sm:h-7 sm:w-7 sm:text-xs ${resultTone}`}
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
              accent={
                "accent" in awayColors
                  ? (awayColors as { accent?: string }).accent
                  : undefined
              }
              compact
              align="right"
              surface={selected ? "resultRowSelected" : "resultRow"}
            />
          </div>
        </>
      )}
    </Wrapper>
  );
}
