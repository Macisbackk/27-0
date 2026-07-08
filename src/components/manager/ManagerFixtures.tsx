"use client";

import { useMemo, useState } from "react";
import { ClubColorChip } from "@/components/ClubColorChip";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import { ManagerFormStrip, ManagerStat, ManagerViewHeader, leaguePositionTone, matchPredictionTone } from "@/components/manager/manager-ui";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getManagerOpponentPoolOptions } from "@/lib/manager/managerLeagueRosters";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import {
  CARD,
  SPACING,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubColors } from "@/lib/clubs";
import {
  managerFixtureCardClass,
  managerFixtureCardStyle,
  managerFixtureRowClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { getFriendlyDualBorderStyle } from "@/lib/manager/managerFriendlyUi";
import {
  buildMergedDisplaySchedule,
} from "@/lib/manager/managerChallengeCup";
import { syncBracketProgress } from "@/lib/manager/managerBracketSync";
import { getHomeFixtureAttendanceOutlook } from "@/lib/manager/managerAttendance";
import {
  getManagerPlayedFixtureLabel,
  getManagerScheduledFixtureHeadline,
  getManagerScheduledFixtureVenueLabel,
  isChallengeCupFixture,
  managerFixtureDisplayId,
} from "@/lib/manager/managerFixtureDisplay";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture, isManagerSeasonComplete } from "@/lib/manager/managerSimulation";
import type {
  ManagerCareer,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";

interface ManagerFixturesProps {
  career: ManagerCareer;
  onSelectFixture: (fixtureId: string) => void;
}

type FixtureFilter =
  | "all"
  | "upcoming"
  | "results"
  | "league"
  | "cup"
  | "playoffs"
  | "friendlies";

type FixtureListItem =
  | {
      kind: "played";
      key: string;
      fixture: ManagerFixtureRecord;
      competition: ManagerFixtureRecord["competition"];
    }
  | {
      kind: "upcoming";
      key: string;
      sched: ManagerScheduledFixture;
      isNext: boolean;
    };

const FILTERS: { id: FixtureFilter; label: string; shortLabel?: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming", shortLabel: "Next" },
  { id: "results", label: "Results" },
  { id: "league", label: "League" },
  { id: "cup", label: "Cup" },
  { id: "playoffs", label: "Play-Offs", shortLabel: "Playoffs" },
  { id: "friendlies", label: "Friendlies", shortLabel: "Friendlies" },
];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function findPlayedForSchedule(
  career: ManagerCareer,
  sched: ManagerScheduledFixture
): ManagerFixtureRecord | undefined {
  return career.fixtures.find(
    (f) =>
      f.fixtureId === sched.id ||
      (f.round === sched.round &&
        f.competition === sched.competition &&
        f.opponent === sched.opponent)
  );
}

function matchesCompetitionFilter(
  competition: ManagerFixtureRecord["competition"] | ManagerScheduledFixture["competition"],
  filter: FixtureFilter
): boolean {
  if (filter === "all" || filter === "upcoming" || filter === "results") {
    return true;
  }
  if (filter === "league") return competition === "league" || !competition;
  if (filter === "cup") return competition === "challenge_cup";
  if (filter === "playoffs") return competition === "playoffs";
  if (filter === "friendlies") return competition === "friendly";
  return true;
}

function buildFixtureList(
  career: ManagerCareer,
  nextFixture: ManagerScheduledFixture | null
): FixtureListItem[] {
  const displaySchedule = buildMergedDisplaySchedule(career);
  const items: FixtureListItem[] = [];
  const matchedFixtureIds = new Set<string>();

  for (const sched of displaySchedule) {
    const played = findPlayedForSchedule(career, sched);
    if (played) {
      const fixtureId = played.fixtureId ?? sched.id;
      matchedFixtureIds.add(fixtureId);
      items.push({
        kind: "played",
        key: sched.id,
        fixture: played,
        competition: played.competition ?? sched.competition,
      });
      continue;
    }

    if (sched.competition === "challenge_cup") {
      const cupDone = career.fixtures.some(
        (f) =>
          f.competition === "challenge_cup" &&
          f.meta?.cupRound === sched.cupRound
      );
      if (cupDone || career.challengeCup.userEliminated) continue;
    }

    items.push({
      kind: "upcoming",
      key: sched.id,
      sched,
      isNext: sched.id === nextFixture?.id,
    });
  }

  const extras = career.fixtures.filter((f) => {
    const id = f.fixtureId ?? `extra-${f.round}-${f.competition}-${f.opponent}`;
    if (matchedFixtureIds.has(id)) return false;
    if (f.fixtureId) matchedFixtureIds.add(f.fixtureId);
    return f.competition === "playoffs" || f.competition === "friendly";
  });

  for (const fixture of extras) {
    items.push({
      kind: "played",
      key: fixture.fixtureId ?? `extra-${fixture.round}-${fixture.opponent}`,
      fixture,
      competition: fixture.competition,
    });
  }

  if (nextFixture) {
    const alreadyListed = items.some(
      (i) =>
        (i.kind === "upcoming" && i.sched.id === nextFixture.id) ||
        (i.kind === "played" &&
          (i.fixture.fixtureId === nextFixture.id ||
            i.fixture.fixtureId === nextFixture.cupMatchId))
    );
    if (!alreadyListed) {
      items.push({
        kind: "upcoming",
        key: nextFixture.id,
        sched: nextFixture,
        isNext: true,
      });
    }
  }

  return items;
}

function FormStrip({ results }: { results: ("W" | "L" | "D")[] }) {
  return <ManagerFormStrip results={results} />;
}

function UpcomingFixtureRow({
  sched,
  club,
  isNext,
}: {
  sched: ManagerScheduledFixture;
  club: string;
  isNext: boolean;
}) {
  const opponent = sched.opponent;
  const opponentColors = opponent !== "TBC" ? getClubColors(opponent) : null;
  const userColors = getClubColors(club);
  const homeName =
    sched.isNeutral && sched.listedHome
      ? sched.listedHome
      : sched.isHome
        ? club
        : opponent;
  const awayName =
    sched.isNeutral && sched.listedAway
      ? sched.listedAway
      : sched.isHome
        ? opponent
        : club;
  const homeColors =
    sched.isNeutral && sched.listedHome
      ? getClubColors(sched.listedHome)
      : sched.isHome
        ? userColors
        : opponentColors ?? userColors;
  const awayColors =
    sched.isNeutral && sched.listedAway
      ? getClubColors(sched.listedAway)
      : sched.isHome
        ? opponentColors ?? userColors
        : userColors;
  const isFriendly = sched.competition === "friendly";
  const friendlyBorderStyle =
    isFriendly && opponent !== "TBC"
      ? getFriendlyDualBorderStyle(club, opponent)
      : undefined;

  return (
    <div
      className={managerFixtureRowClass({
        isNext,
        competition: sched.competition,
        hasFriendlyStyle: Boolean(friendlyBorderStyle),
      })}
      style={friendlyBorderStyle}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ManagerCompetitionBadge
            competition={sched.competition}
            cupRound={sched.cupRound}
            detailed={false}
          />
          {isNext && (
            <span className={managerPillClass("primary")}>
              Next
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            sched.isNeutral
              ? "bg-accent-gold/15 text-accent-gold"
              : sched.isHome
                ? "bg-theme-primary/15 text-theme-primary"
                : "bg-pitch-700/80 text-pitch-300"
          }`}
        >
          {getManagerScheduledFixtureVenueLabel(sched)}
        </span>
      </div>

      <p className={`mt-2 break-words ${TYPO.bodySm} text-pitch-400`}>
        {getManagerScheduledFixtureHeadline(sched)}
      </p>

      {opponent !== "TBC" ? (
        <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-3">
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
          />
          <span className="shrink-0 px-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-pitch-500 sm:text-xs">
            vs
          </span>
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
          />
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-white">Opponent TBC</p>
      )}
    </div>
  );
}

export function ManagerFixtures({
  career,
  onSelectFixture,
}: ManagerFixturesProps) {
  const [filter, setFilter] = useState<FixtureFilter>("all");
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);

  const readyCareer = syncBracketProgress(career);
  const nextFixture = getNextManagerFixture(readyCareer);
  const seasonComplete = isManagerSeasonComplete(readyCareer);

  const simCareer = resolveCareerForMatchSimulation(career);
  const teamRating = computeManagerTeamRating(
    simCareer.matchdayXiii,
    simCareer.matchdayInterchange,
    simCareer.xiiiSlotPositions,
    simCareer
  );

  const oppRating =
    nextFixture && !seasonComplete
      ? nextFixture.competition === "friendly" &&
        career.preSeason.activeFriendly
        ? career.preSeason.activeFriendly.teamRating
        : Math.round(
            getOpponentMatchRating(
              nextFixture.opponent,
              readyCareer.seed,
              nextFixture.round,
              getManagerOpponentPoolOptions(readyCareer, nextFixture.opponent)
            )
          )
      : null;

  const prediction =
    nextFixture && !seasonComplete
      ? getMatchPrediction(
          teamRating,
          oppRating ?? 70,
          nextFixture.isNeutral ? true : nextFixture.isHome
        )
      : null;

  const homeAttendanceOutlook =
    nextFixture && !seasonComplete
      ? getHomeFixtureAttendanceOutlook(career, nextFixture)
      : null;

  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const ts = career.teamSeasonStats;
  const recentForm = career.recentForm.slice(-5) as ("W" | "L" | "D")[];

  const allItems = useMemo(
    () => buildFixtureList(career, nextFixture),
    [career, nextFixture]
  );

  const filteredItems = useMemo(() => {
    let items = allItems.filter((item) => {
      const comp =
        item.kind === "played"
          ? item.competition ?? "league"
          : item.sched.competition;
      return matchesCompetitionFilter(comp, filter);
    });

    if (filter === "upcoming") {
      items = items.filter((i) => i.kind === "upcoming");
    } else if (filter === "results") {
      items = items
        .filter((i) => i.kind === "played")
        .reverse();
    }

    return items;
  }, [allItems, filter]);

  const playedCount = allItems.filter((i) => i.kind === "played").length;
  const upcomingCount = allItems.filter((i) => i.kind === "upcoming").length;

  const showUpcomingFirst =
    filter === "all" ||
    filter === "upcoming" ||
    filter === "league" ||
    filter === "cup" ||
    filter === "playoffs" ||
    filter === "friendlies";
  const upcomingItems = filteredItems.filter((i) => i.kind === "upcoming");
  const playedItems = filteredItems.filter((i) => i.kind === "played");
  const playedDisplay =
    filter === "results" ? playedItems : [...playedItems].reverse();

  return (
    <div className={`mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden ${SPACING.stackLg}`}>
      <ManagerViewHeader
        title="Fixtures"
        subtitle={`Season ${career.seasonYear} · ${career.club}`}
        tabs={
          <ManagerSubTabBar
            tabs={FILTERS}
            active={filter}
            onChange={setFilter}
            scrollable
            ariaLabel="Filter fixtures"
          />
        }
      />

      <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Season snapshot</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ManagerStat
            label="Record"
            value={`${career.wins}W – ${career.losses}L`}
            tone="default"
            large
          />
          <ManagerStat
            label="Points diff"
            value={`${ts.pointsDifference > 0 ? "+" : ""}${ts.pointsDifference}`}
            tone={
              ts.pointsDifference > 0
                ? "primary"
                : ts.pointsDifference < 0
                  ? "red"
                  : "default"
            }
            large
          />
          <ManagerStat
            label="League"
            value={ordinal(position)}
            tone={leaguePositionTone(position)}
            large
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
              Form
            </p>
            <div className="mt-1">
              <FormStrip results={recentForm} />
            </div>
          </div>
        </div>
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          {playedCount} played · {upcomingCount} remaining · Week{" "}
          {career.gameWeek}/{career.schedule.length}
        </p>
      </div>

      {nextFixture && !seasonComplete && (
        <div
          className={managerFixtureCardClass(nextFixture.competition)}
          style={managerFixtureCardStyle(
            nextFixture.competition,
            career.club,
            nextFixture.opponent
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={TYPO.sectionLabel}>Next match</p>
            <ManagerCompetitionBadge
              competition={nextFixture.competition}
              cupRound={nextFixture.cupRound}
              detailed={isChallengeCupFixture(nextFixture.competition)}
            />
          </div>
          <p className="mt-2 break-words text-base font-bold leading-snug text-white sm:text-2xl">
            <span className="block sm:inline">{career.club}</span>{" "}
            <span className="text-pitch-500">
              {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
            </span>{" "}
            <span className="block sm:inline">{nextFixture.opponent}</span>
          </p>
          <p className={`mt-1 break-words ${TYPO.bodySm} text-pitch-400`}>
            {getManagerScheduledFixtureHeadline(nextFixture)} ·{" "}
            {getManagerScheduledFixtureVenueLabel(nextFixture)}
          </p>
          {homeAttendanceOutlook && (
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-500`}>
              {homeAttendanceOutlook.label}
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {homeAttendanceOutlook && (
              <ManagerStat
                label="Expected gate"
                value={`~${homeAttendanceOutlook.predictedAttendance.toLocaleString()}`}
                tone="sky"
              />
            )}
            {prediction && (
              <ManagerStat
                label="Prediction"
                value={prediction}
                tone={matchPredictionTone(prediction)}
              />
            )}
          </div>
          <GameButton
            variant="secondary"
            size="sm"
            className="mt-4 w-full sm:w-auto"
            onClick={() => {
              playUiClick();
              setViewClubSheet(nextFixture.opponent);
            }}
          >
            View {nextFixture.opponent} team sheet
          </GameButton>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className={`${CARD.base} ${SPACING.cardPadding} text-center`}>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No fixtures match this filter.
          </p>
        </div>
      ) : (
        <div className={SPACING.stackLg}>
          {showUpcomingFirst && upcomingItems.length > 0 && (
            <section className={SPACING.stackSm}>
              <h2 className={TYPO.sectionLabel}>
                Upcoming
                <span className="ml-2 font-normal text-pitch-500">
                  ({upcomingItems.length})
                </span>
              </h2>
              <div className={SPACING.stackSm}>
                {upcomingItems.map((item) =>
                  item.kind === "upcoming" ? (
                    <UpcomingFixtureRow
                      key={item.key}
                      sched={item.sched}
                      club={career.club}
                      isNext={item.isNext}
                    />
                  ) : null
                )}
              </div>
            </section>
          )}

          {playedDisplay.length > 0 && (
            <section className={SPACING.stackSm}>
              <h2 className={TYPO.sectionLabel}>
                {filter === "results" ? "Results" : "Played"}
                <span className="ml-2 font-normal text-pitch-500">
                  ({playedDisplay.length})
                </span>
              </h2>
              <div className={SPACING.stackSm}>
                {playedDisplay.map((item) => {
                  if (item.kind !== "played") return null;
                  const { fixture } = item;
                  const fixtureId = managerFixtureDisplayId(fixture);
                  const attendance = fixture.meta?.attendance?.attendance;

                  return (
                    <div key={item.key} className={SPACING.stackSm}>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
                        {fixture.competition && (
                          <ManagerCompetitionBadge
                            competition={fixture.competition}
                            cupRound={fixture.meta?.cupRound}
                            detailed={false}
                          />
                        )}
                        {attendance != null && (
                          <span className={`shrink-0 ${TYPO.bodySm} text-pitch-500`}>
                            Attendance {attendance.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <FixtureResultRow
                        fixture={fixture}
                        userTeamName={career.club}
                        roundLabel={getManagerPlayedFixtureLabel(fixture)}
                        cupHighlight={isChallengeCupFixture(fixture.competition)}
                        onClick={() => {
                          playUiClick();
                          onSelectFixture(fixtureId);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!showUpcomingFirst && upcomingItems.length > 0 && (
            <section className={SPACING.stackSm}>
              <h2 className={TYPO.sectionLabel}>
                Upcoming
                <span className="ml-2 font-normal text-pitch-500">
                  ({upcomingItems.length})
                </span>
              </h2>
              <div className={SPACING.stackSm}>
                {upcomingItems.map((item) =>
                  item.kind === "upcoming" ? (
                    <UpcomingFixtureRow
                      key={item.key}
                      sched={item.sched}
                      club={career.club}
                      isNext={item.isNext}
                    />
                  ) : null
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {viewClubSheet && (
        <ManagerClubSquadSheet
          career={career}
          club={viewClubSheet}
          onClose={() => setViewClubSheet(null)}
        />
      )}
    </div>
  );
}
