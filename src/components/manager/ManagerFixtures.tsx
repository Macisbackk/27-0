"use client";

import { useMemo, useState } from "react";
import { ClubColorChip } from "@/components/ClubColorChip";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import { ManagerFormStrip, ManagerStat, leaguePositionTone, matchPredictionTone } from "@/components/manager/manager-ui";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import {
  CARD,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubColors } from "@/lib/clubs";
import {
  buildMergedDisplaySchedule,
  ensureCupBracketReady,
} from "@/lib/manager/managerChallengeCup";
import { getHomeFixtureAttendanceOutlook } from "@/lib/manager/managerAttendance";
import {
  getManagerPlayedFixtureLabel,
  getManagerScheduledFixtureHeadline,
  isChallengeCupFixture,
} from "@/lib/manager/managerFixtureDisplay";
import { ensurePlayoffsReady } from "@/lib/manager/managerPlayoffs";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getNextManagerFixture } from "@/lib/manager/managerSimulation";
import type {
  ManagerCareer,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

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

const FILTERS: { id: FixtureFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "results", label: "Results" },
  { id: "league", label: "League" },
  { id: "cup", label: "Cup" },
  { id: "playoffs", label: "Play-Offs" },
  { id: "friendlies", label: "Friendlies" },
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
  const homeName = sched.isHome ? club : opponent;
  const awayName = sched.isHome ? opponent : club;
  const homeColors = sched.isHome ? userColors : opponentColors ?? userColors;
  const awayColors = sched.isHome ? opponentColors ?? userColors : userColors;
  const isCup = isChallengeCupFixture(sched.competition);
  const isPlayoff = sched.competition === "playoffs";
  const isFriendly = sched.competition === "friendly";

  return (
    <div
      className={`rounded-lg border px-3 py-3 sm:px-4 ${
        isNext
          ? "border-theme-primary/50 bg-theme-primary/5 ring-1 ring-theme-primary/25"
          : isCup
            ? "border-accent-gold/35 bg-accent-gold/5"
            : isPlayoff
              ? "border-theme-primary/30 bg-theme-primary/5"
              : isFriendly
                ? "border-sky-400/30 bg-sky-400/5"
                : "border-pitch-700/50 bg-pitch-950/50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ManagerCompetitionBadge
            competition={sched.competition}
            cupRound={sched.cupRound}
            detailed={isCup}
          />
          {isNext && (
            <span className="rounded-full border border-theme-primary/40 bg-theme-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-theme-primary">
              Next
            </span>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            sched.isHome
              ? "bg-theme-primary/15 text-theme-primary"
              : "bg-pitch-700/80 text-pitch-300"
          }`}
        >
          {sched.isHome ? "Home" : "Away"}
        </span>
      </div>

      <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
        {getManagerScheduledFixtureHeadline(sched)}
      </p>

      {opponent !== "TBC" ? (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
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
          <span className="font-display text-xs font-bold uppercase tracking-widest text-pitch-500">
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

  const readyCareer = ensurePlayoffsReady(ensureCupBracketReady(career));
  const nextFixture = getNextManagerFixture(readyCareer);

  const simCareer = resolveCareerForMatchSimulation(career);
  const teamRating = computeManagerTeamRating(
    simCareer.matchdayXiii,
    simCareer.matchdayInterchange,
    simCareer.xiiiSlotPositions,
    simCareer
  );

  const oppRating =
    nextFixture && !career.isSeasonComplete
      ? nextFixture.competition === "friendly" &&
        career.preSeason.activeFriendly
        ? career.preSeason.activeFriendly.teamRating
        : Math.round(
            getOpponentMatchRating(
              nextFixture.opponent,
              career.seed,
              nextFixture.round,
              { currentSeasonOnly: nextFixture.competition !== "friendly" }
            )
          )
      : null;

  const prediction =
    nextFixture && !career.isSeasonComplete
      ? getMatchPrediction(teamRating, oppRating ?? 70, nextFixture.isHome)
      : null;

  const homeAttendanceOutlook =
    nextFixture?.isHome && !career.isSeasonComplete
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
    filter === "friendlies";
  const upcomingItems = filteredItems.filter((i) => i.kind === "upcoming");
  const playedItems = filteredItems.filter((i) => i.kind === "played");
  const playedDisplay =
    filter === "results" ? playedItems : [...playedItems].reverse();

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Fixtures</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · {career.club}
        </p>
      </div>

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

      {nextFixture && !career.isSeasonComplete && (
        <div
          className={`${CARD.elevated} ${SPACING.cardPadding} ${
            isChallengeCupFixture(nextFixture.competition)
              ? "border border-accent-gold/35 ring-1 ring-accent-gold/20"
              : "border-l-4 border-theme-primary"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={TYPO.sectionLabel}>Next match</p>
            <ManagerCompetitionBadge
              competition={nextFixture.competition}
              cupRound={nextFixture.cupRound}
              detailed={isChallengeCupFixture(nextFixture.competition)}
            />
          </div>
          <p className="mt-2 text-xl font-bold text-white sm:text-2xl">
            {career.club} {nextFixture.isHome ? "vs" : "@"}{" "}
            {nextFixture.opponent}
          </p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            {getManagerScheduledFixtureHeadline(nextFixture)} ·{" "}
            {nextFixture.isHome ? "Home" : "Away"}
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
        </div>
      )}

      <div className={tabGroupClass()}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={tabGroupButtonClass(filter === f.id)}
            onClick={() => {
              playUiClick();
              setFilter(f.id);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

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
                  const fixtureId = fixture.fixtureId ?? item.key;
                  const attendance = fixture.meta?.attendance?.attendance;

                  return (
                    <div key={item.key} className={SPACING.stackSm}>
                      <div className="flex flex-wrap items-center gap-2 px-0.5">
                        {fixture.competition && (
                          <ManagerCompetitionBadge
                            competition={fixture.competition}
                            cupRound={fixture.meta?.cupRound}
                            detailed={isChallengeCupFixture(fixture.competition)}
                          />
                        )}
                        {attendance != null && (
                          <span className={`${TYPO.bodySm} text-pitch-500`}>
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
    </div>
  );
}
