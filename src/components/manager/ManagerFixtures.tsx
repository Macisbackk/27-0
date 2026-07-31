"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ClubColorChip } from "@/components/ClubColorChip";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  ManagerFormStrip,
  ManagerPage,
  ManagerSection,
  ManagerStat,
  leaguePositionTone,
  matchPredictionTone,
} from "@/components/manager/manager-ui";
import { getMatchPrediction } from "@/lib/manager/managerScoring";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getManagerOpponentPoolOptions } from "@/lib/manager/managerLeagueRosters";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { resolveCareerForMatchSimulation } from "@/lib/manager/managerAutoFix";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { SPACING } from "@/lib/ui/design-system";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { TYPO } from "@/lib/ui/typography";
import { getClubColors } from "@/lib/clubs";
import {
  managerFixtureCardStyle,
  managerFixtureRowClass,
  managerPillClass,
} from "@/lib/manager/managerSurfaces";
import { getManagerMatchOccasionPresentation } from "@/lib/manager/managerMatchOccasion";
import { getFriendlyDualBorderStyle } from "@/lib/manager/managerFriendlyUi";
import { buildMergedDisplaySchedule } from "@/lib/manager/managerChallengeCup";
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
  WorldClubChallengeFixture,
} from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import seedrandom from "seedrandom";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";
import {
  buildWorldClubChallengeScheduledFixture,
  getWccStats,
  isValidWorldClubChallengeFixture,
  pickNrlChampion,
  rollNrlChampionRating,
} from "@/lib/manager/worldClubChallenge";
import { GamePanel } from "@/components/ui/GamePanel";

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
  | "wcc";

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
  { id: "wcc", label: "World Club Challenge", shortLabel: "WCC" },
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
  if (filter === "wcc") return competition === "world_club_challenge";
  return true;
}

function shouldShowNextMatch(
  filter: FixtureFilter,
  nextFixture: ManagerScheduledFixture | null
): boolean {
  if (!nextFixture) return false;
  if (filter === "results") return false;
  const comp = nextFixture.competition ?? "league";
  if (filter === "all" || filter === "upcoming") return true;
  if (filter === "wcc") return comp === "world_club_challenge";
  if (filter === "cup") return comp === "challenge_cup";
  if (filter === "league") return comp === "league" || !nextFixture.competition;
  if (filter === "playoffs") return comp === "playoffs";
  return true;
}

function resolveWccFixtureForDisplay(
  career: ManagerCareer,
  wcc: WorldClubChallengeFixture
): WorldClubChallengeFixture {
  if (isValidWorldClubChallengeFixture(wcc)) return wcc;
  const nrlChampion = pickNrlChampion(career.seed, career.seasonYear);
  const rng = seedrandom(
    `${career.seed}-wcc-display-${career.seasonYear}-${nrlChampion}`
  );
  return {
    ...wcc,
    nrlChampionName: nrlChampion,
    nrlChampionRating: rollNrlChampionRating(rng),
  };
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

  const wccCurrent = career.worldClubChallenge?.currentFixture;
  if (wccCurrent?.status === "scheduled") {
    const wcc = resolveWccFixtureForDisplay(career, wccCurrent);
    const sched = buildWorldClubChallengeScheduledFixture(wcc);
    const alreadyListed = items.some(
      (i) =>
        (i.kind === "upcoming" &&
          (i.sched.id === sched.id ||
            i.sched.competition === "world_club_challenge")) ||
        (i.kind === "played" && i.fixture.fixtureId === sched.id)
    );
    if (!alreadyListed) {
      items.push({
        kind: "upcoming",
        key: sched.id,
        sched,
        isNext: sched.id === nextFixture?.id,
      });
    }
  }

  return items;
}

function itemCompetition(
  item: FixtureListItem
): NonNullable<ManagerFixtureRecord["competition"]> {
  if (item.kind === "played") return item.competition ?? "league";
  return item.sched.competition ?? "league";
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
            playoffRound={sched.playoffRound}
            isNeutral={sched.isNeutral}
            venue={sched.venue}
            detailed={false}
          />
          {isNext && <span className={managerPillClass("primary")}>Next</span>}
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
      {(() => {
        const occasion = getManagerMatchOccasionPresentation(sched);
        if (!occasion.isShowcase || !occasion.momentLine) return null;
        return (
          <p className={`mt-1 text-xs font-semibold ${occasion.momentTextClass}`}>
            {occasion.momentLine}
          </p>
        );
      })()}

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

function PlayedFixtureRow({
  item,
  club,
  onSelectFixture,
}: {
  item: Extract<FixtureListItem, { kind: "played" }>;
  club: string;
  onSelectFixture: (fixtureId: string) => void;
}) {
  const { fixture } = item;
  const fixtureId = managerFixtureDisplayId(fixture);
  const attendance = fixture.meta?.attendance?.attendance;

  return (
    <div className={SPACING.stackSm}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {fixture.competition && (
          <ManagerCompetitionBadge
            competition={fixture.competition}
            cupRound={fixture.meta?.cupRound}
            isNeutral={fixture.isNeutral}
            venue={fixture.meta?.attendance?.venue}
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
        userTeamName={club}
        roundLabel={getManagerPlayedFixtureLabel(fixture)}
        cupHighlight={isChallengeCupFixture(fixture.competition)}
        onClick={() => {
          playUiClick();
          onSelectFixture(fixtureId);
        }}
      />
    </div>
  );
}

function FixtureItemList({
  items,
  club,
  onSelectFixture,
}: {
  items: FixtureListItem[];
  club: string;
  onSelectFixture: (fixtureId: string) => void;
}) {
  return (
    <div className={SPACING.stackSm}>
      {items.map((item) =>
        item.kind === "upcoming" ? (
          <UpcomingFixtureRow
            key={item.key}
            sched={item.sched}
            club={club}
            isNext={item.isNext}
          />
        ) : (
          <PlayedFixtureRow
            key={item.key}
            item={item}
            club={club}
            onSelectFixture={onSelectFixture}
          />
        )
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
      ? nextFixture.competition === "world_club_challenge" &&
        career.worldClubChallenge?.currentFixture
        ? career.worldClubChallenge.currentFixture.nrlChampionRating
        : nextFixture.competition === "friendly" &&
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
    let items = allItems.filter((item) =>
      matchesCompetitionFilter(itemCompetition(item), filter)
    );

    if (filter === "upcoming") {
      items = items.filter((i) => i.kind === "upcoming");
    } else if (filter === "results") {
      items = items.filter((i) => i.kind === "played").reverse();
    }

    return items;
  }, [allItems, filter]);

  const playedCount = allItems.filter((i) => i.kind === "played").length;
  const upcomingCount = allItems.filter((i) => i.kind === "upcoming").length;

  const upcomingItems = useMemo(
    () =>
      filteredItems.filter((i) => {
        if (i.kind !== "upcoming") return false;
        if (filter === "all" && i.sched.competition === "world_club_challenge") {
          return false;
        }
        return true;
      }),
    [filteredItems, filter]
  );

  const challengeCupItems = useMemo(
    () =>
      filteredItems.filter(
        (i) => i.kind === "upcoming" && itemCompetition(i) === "challenge_cup"
      ),
    [filteredItems]
  );

  const leagueUpcomingItems = useMemo(
    () =>
      upcomingItems.filter(
        (i) =>
          i.kind === "upcoming" &&
          (i.sched.competition === "league" || !i.sched.competition)
      ),
    [upcomingItems]
  );

  const playoffItems = useMemo(
    () =>
      filteredItems.filter(
        (i) => i.kind === "upcoming" && itemCompetition(i) === "playoffs"
      ),
    [filteredItems]
  );

  /** Completed fixtures only under Results — never inside upcoming sections. */
  const completedResultsItems = useMemo(() => {
    if (filter !== "results") return [];
    return filteredItems.filter((i) => i.kind === "played");
  }, [filteredItems, filter]);

  const showChallengeCup = filter === "all" || filter === "cup";
  const showSuperLeague = filter === "all" || filter === "league";
  const showPlayoffs =
    (filter === "all" || filter === "playoffs") && playoffItems.length > 0;
  const showUpcomingFilter = filter === "upcoming" && upcomingItems.length > 0;
  const showCompletedResults =
    filter === "results" && completedResultsItems.length > 0;

  const wccStats = getWccStats(career);
  const wccCurrentRaw = career.worldClubChallenge?.currentFixture;
  const wccCurrent =
    wccCurrentRaw && wccCurrentRaw.status !== "complete"
      ? resolveWccFixtureForDisplay(career, wccCurrentRaw)
      : null;
  const wccHistory =
    filter === "results" || filter === "wcc"
      ? wccStats.results.slice().reverse()
      : [];
  const showWcc =
    filter === "all" ||
    filter === "wcc" ||
    (filter === "results" && wccHistory.length > 0);

  const wccHistoryList =
    wccHistory.length > 0 ? (
      <ul className="space-y-2">
        {wccHistory.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-pitch-700/40 bg-pitch-900/30 p-3"
          >
            <p className="font-semibold text-white">
              {r.seasonYear} — {r.superLeagueChampionName} {r.homeScore}–
              {r.awayScore} {r.nrlChampionName}
            </p>
            <p className={TYPO.bodySm}>
              Winner: {r.winnerName}
              {r.userResult && r.userResult !== "not_involved"
                ? ` · You ${r.userResult}`
                : " · AI result"}
            </p>
            <p className={`mt-1 ${TYPO.bodySm}`}>{r.storySummary}</p>
          </li>
        ))}
      </ul>
    ) : null;

  let wccPanelContent: ReactNode = null;
  if (filter === "results" && wccHistoryList) {
    wccPanelContent = wccHistoryList;
  } else if (filter === "wcc") {
    wccPanelContent = (
      <div className="space-y-4">
        {wccCurrent ? (
          <div className="space-y-2">
            <p className={`${TYPO.sectionLabel} text-sky-300`}>This season</p>
            <p className="font-semibold text-white">
              {wccCurrent.superLeagueChampionName} vs {wccCurrent.nrlChampionName}
            </p>
            <p className={TYPO.bodySm}>
              Game Week {wccCurrent.gameWeek} · Season {wccCurrent.seasonYear} ·
              NRL rating {wccCurrent.nrlChampionRating}
            </p>
            {wccCurrent.userInvolved ? (
              <p className={`${TYPO.bodySm} text-accent-gold`}>
                You are the Super League champion — Play or Simulate from
                Matchday when Game Week 3 arrives.
              </p>
            ) : (
              <p className={TYPO.bodySm}>
                Another Super League club is involved this year.
              </p>
            )}
          </div>
        ) : (
          <p className={TYPO.bodySm}>
            {wccHistory.length > 0
              ? "No World Club Challenge fixture scheduled this season."
              : "World Club Challenge starts from your second season once a Super League champion has been crowned."}
          </p>
        )}
        {wccHistoryList ? (
          <div className="space-y-2">
            <p className={`${TYPO.sectionLabel} text-sky-300`}>Past results</p>
            {wccHistoryList}
          </div>
        ) : null}
      </div>
    );
  } else if (wccCurrent) {
    wccPanelContent = (
      <div className="space-y-2">
        <p className="font-semibold text-white">
          {wccCurrent.superLeagueChampionName} vs {wccCurrent.nrlChampionName}
        </p>
        <p className={TYPO.bodySm}>
          Game Week {wccCurrent.gameWeek} · Season {wccCurrent.seasonYear} · NRL
          rating {wccCurrent.nrlChampionRating}
        </p>
        {wccCurrent.userInvolved ? (
          <p className={`${TYPO.bodySm} text-accent-gold`}>
            You are the Super League champion — Play or Simulate from Matchday
            when Game Week 3 arrives.
          </p>
        ) : (
          <p className={TYPO.bodySm}>
            Another Super League club is involved this year.
          </p>
        )}
      </div>
    );
  } else if (filter === "all") {
    wccPanelContent = (
      <p className={TYPO.bodySm}>
        World Club Challenge starts from your second season once a Super League
        champion has been crowned.
      </p>
    );
  }

  const showNextMatch =
    nextFixture &&
    !seasonComplete &&
    shouldShowNextMatch(filter, nextFixture);

  const nextMatchOccasion = showNextMatch
    ? getManagerMatchOccasionPresentation(nextFixture)
    : null;

  const hasAnySection =
    showNextMatch ||
    (showWcc && wccPanelContent) ||
    (showChallengeCup && challengeCupItems.length > 0) ||
    (showSuperLeague && leagueUpcomingItems.length > 0) ||
    showPlayoffs ||
    showUpcomingFilter ||
    showCompletedResults;

  return (
    <ManagerPage>
      <ManagerSection className="manager-fixtures">
      <GameSectionHeader
        label="Fixtures"
        title="Fixtures"
        subtitle={`Season ${career.seasonYear} · ${career.club}`}
      />

      <div className="flex w-full min-w-0 justify-center">
        <ManagerSubTabBar
          tabs={FILTERS}
          active={filter}
          onChange={setFilter}
          scrollable
          ariaLabel="Filter fixtures"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-4 sm:gap-5">
      <GamePanel padded label="Season">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <ManagerFormStrip results={recentForm} />
            </div>
          </div>
        </div>
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          {playedCount} played · {upcomingCount} remaining · Week{" "}
          {career.gameWeek}/{career.schedule.length}
        </p>
      </GamePanel>

      {showNextMatch && nextFixture && nextMatchOccasion && (
        <ScoreboardPanel
          variant="elevated"
          padded
          className={`matchday-scoreboard ${nextMatchOccasion.surfaceClass} ${nextMatchOccasion.matchdayModifier}`.trim()}
          style={managerFixtureCardStyle(
            nextFixture.competition,
            career.club,
            nextFixture.opponent
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={TYPO.sectionLabel}>{nextMatchOccasion.weekLabel}</p>
            <ManagerCompetitionBadge
              competition={nextFixture.competition}
              cupRound={nextFixture.cupRound}
              playoffRound={nextFixture.playoffRound}
              isNeutral={nextFixture.isNeutral}
              venue={nextFixture.venue}
              detailed={
                nextMatchOccasion.isShowcase ||
                isChallengeCupFixture(nextFixture.competition)
              }
            />
          </div>
          <p className="mt-2 break-words text-base font-bold leading-snug text-white sm:text-2xl">
            <span className="block sm:inline">{career.club}</span>{" "}
            <span className="text-pitch-500">
              {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
            </span>{" "}
            <span className="block sm:inline">{nextFixture.opponent}</span>
          </p>
          {nextMatchOccasion.momentLine ? (
            <p
              className={`mt-2 text-sm font-semibold ${nextMatchOccasion.momentTextClass}`}
            >
              {nextMatchOccasion.momentLine}
            </p>
          ) : null}
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
            {oppRating != null && (
              <ManagerStat
                label="Opponent rating"
                value={String(oppRating)}
                tone="default"
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
        </ScoreboardPanel>
      )}

          {showWcc && wccPanelContent && (
        <GamePanel padded label="World Club Challenge">
          {wccPanelContent}
        </GamePanel>
      )}

      {showChallengeCup && challengeCupItems.length > 0 && (
        <GamePanel
          padded
          label={`Challenge Cup (${challengeCupItems.length})`}
        >
          <FixtureItemList
            items={challengeCupItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
          />
        </GamePanel>
      )}

      {showSuperLeague && leagueUpcomingItems.length > 0 && (
        <GamePanel
          padded
          label={`Super League fixtures (${leagueUpcomingItems.length})`}
        >
          <FixtureItemList
            items={leagueUpcomingItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
          />
        </GamePanel>
      )}

      {showPlayoffs && (
        <GamePanel padded label={`Play-offs (${playoffItems.length})`}>
          <FixtureItemList
            items={playoffItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
          />
        </GamePanel>
      )}

      {showUpcomingFilter && (
        <GamePanel padded label={`Upcoming (${upcomingItems.length})`}>
          <FixtureItemList
            items={upcomingItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
          />
        </GamePanel>
      )}

      {showCompletedResults && (
        <GamePanel
          padded
          label={`Completed results (${completedResultsItems.length})`}
        >
          <FixtureItemList
            items={completedResultsItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
          />
        </GamePanel>
      )}

      {!hasAnySection && (
        <GamePanel padded>
          <p className={`text-center ${TYPO.bodySm} text-pitch-400`}>
            No fixtures match this filter.
          </p>
        </GamePanel>
      )}

      {viewClubSheet && (
        <ManagerClubSquadSheet
          career={career}
          club={viewClubSheet}
          onClose={() => setViewClubSheet(null)}
        />
      )}
      </div>
      </ManagerSection>
    </ManagerPage>
  );
}
