"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ClubColorChip } from "@/components/ClubColorChip";
import { FixtureResultRow } from "@/components/FixtureResultRow";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  ManagerPage,
  ManagerSection,
  ManagerStat,
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
import { buildMergedDisplaySchedule, getCupBracketForDisplay } from "@/lib/manager/managerChallengeCup";
import { syncBracketProgress } from "@/lib/manager/managerBracketSync";
import { getHomeFixtureAttendanceOutlook } from "@/lib/manager/managerAttendance";
import {
  getManagerFixtureSectionLabel,
  getManagerPlayedFixtureLabel,
  getManagerScheduledFixtureHeadline,
  getManagerScheduledFixtureVenueLabel,
  isChallengeCupFixture,
  managerFixtureDisplayId,
} from "@/lib/manager/managerFixtureDisplay";
import { getNextManagerFixture, isManagerSeasonComplete } from "@/lib/manager/managerSimulation";
import type {
  ManagerCareer,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
  WorldClubChallengeFixture,
  WorldClubChallengeResult,
} from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import seedrandom from "seedrandom";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerClubSquadSheet } from "@/components/manager/ManagerClubSquadSheet";
import {
  buildWorldClubChallengeScheduledFixture,
  getCurrentSeasonWccResult,
  getLatestUserWorldClubChallengeResult,
  getWccStats,
  isValidWorldClubChallengeFixture,
  pickNrlChampion,
  rollNrlChampionRating,
  worldClubChallengeResultToFixtureRecord,
} from "@/lib/manager/worldClubChallenge";
import { GamePanel } from "@/components/ui/GamePanel";
import { ManagerChallengeCupBracket } from "@/components/manager/ManagerChallengeCupBracket";
import { ManagerCalendar } from "@/components/manager/ManagerCalendar";

type FixtureFilter =
  | "calendar"
  | "all"
  | "results"
  | "league"
  | "cup"
  | "playoffs"
  | "wcc";

interface ManagerFixturesProps {
  career: ManagerCareer;
  onSelectFixture: (fixtureId: string) => void;
  /** Career updates (required for Calendar Sim to Date). */
  onUpdate?: (career: ManagerCareer) => void;
  /** When opening from Hub "View Full Bracket", start on Cup. */
  initialFilter?: FixtureFilter;
  onOpenMatchPrep?: () => void;
}

type FixtureListItem =
  | {
      kind: "played";
      key: string;
      fixture: ManagerFixtureRecord;
      competition: ManagerFixtureRecord["competition"];
      /** False for synthetic AI WCC rows that are not in career.fixtures. */
      selectable?: boolean;
    }
  | {
      kind: "upcoming";
      key: string;
      sched: ManagerScheduledFixture;
      isNext: boolean;
    };

const FILTERS: {
  id: FixtureFilter;
  label: string;
  shortLabel?: string;
  title?: string;
}[] = [
  { id: "calendar", label: "Calendar" },
  { id: "all", label: "All" },
  { id: "results", label: "Results" },
  { id: "league", label: "League" },
  { id: "cup", label: "Cup" },
  { id: "playoffs", label: "Play-Offs", shortLabel: "Playoffs" },
  {
    id: "wcc",
    label: "WCC",
    shortLabel: "WCC",
    title: "World Club Challenge",
  },
];

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
  if (filter === "calendar") return false;
  if (filter === "all" || filter === "results") {
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
  if (filter === "results" || filter === "calendar") return false;
  const comp = nextFixture.competition ?? "league";
  if (filter === "all") return true;
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

function itemRound(item: FixtureListItem): number {
  if (item.kind === "upcoming") return item.sched.round;
  return item.fixture.round;
}

function sortUpcomingFirst(items: FixtureListItem[]): FixtureListItem[] {
  return [...items].sort((a, b) => itemRound(a) - itemRound(b));
}

function sortResultsNewestFirst(items: FixtureListItem[]): FixtureListItem[] {
  return [...items].sort((a, b) => itemRound(b) - itemRound(a));
}

/** Completed WCC — same result-row chrome as other Results tabs, write-up below. */
function WccResultBox({
  result,
  club,
  defaultOpen = false,
  compact = false,
}: {
  result: WorldClubChallengeResult;
  club: string;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const fixture = worldClubChallengeResultToFixtureRecord(result, club);
  const userTeamName = fixture.userClub || result.superLeagueChampionName;

  return (
    <div className={compact ? "space-y-1" : SPACING.stackSm}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <ManagerCompetitionBadge
          competition="world_club_challenge"
          isNeutral
          detailed={false}
        />
        <span className={`shrink-0 ${TYPO.bodySm} text-pitch-500`}>
          Season {result.seasonYear}
        </span>
      </div>
      <FixtureResultRow
        fixture={fixture}
        userTeamName={userTeamName}
        roundLabel={getManagerPlayedFixtureLabel(fixture)}
        compact={compact}
      />
      <details className="group" open={defaultOpen || undefined}>
        <summary
          className={`flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-pitch-700/40 bg-pitch-900/30 px-3 py-2 [&::-webkit-details-marker]:hidden`}
        >
          <span className="font-semibold text-white">Match write-up</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-pitch-500 transition group-open:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </summary>
        <div className="mt-2 rounded-lg border border-pitch-700/35 bg-pitch-950/40 px-3 py-2">
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-center gap-2">
            <span className={`${TYPO.bodySm} text-pitch-400`}>Winner:</span>
            <span className="font-semibold text-white">{result.winnerName}</span>
            <span className={TYPO.bodySm}>
              {result.userResult && result.userResult !== "not_involved"
                ? `· You ${result.userResult}`
                : "· AI result"}
            </span>
          </div>
          <p className={`${TYPO.bodySm} text-center text-pitch-300`}>
            {result.storySummary}
          </p>
        </div>
      </details>
    </div>
  );
}

/** Scheduled WCC — same upcoming-row layout as other fixture tabs. */
function WccScheduledBox({
  wcc,
  club,
  isNext = false,
  compact = false,
}: {
  wcc: WorldClubChallengeFixture;
  club: string;
  isNext?: boolean;
  compact?: boolean;
}) {
  const sched: ManagerScheduledFixture = {
    ...buildWorldClubChallengeScheduledFixture(wcc),
    isNeutral: true,
    listedHome: wcc.superLeagueChampionName,
    listedAway: wcc.nrlChampionName,
  };

  return (
    <div className={compact ? "space-y-1" : SPACING.stackSm}>
      <UpcomingFixtureRow
        sched={sched}
        club={wcc.userInvolved ? club : wcc.superLeagueChampionName}
        isNext={isNext}
        compact={compact}
      />
    </div>
  );
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
        selectable: true,
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
    return (
      f.competition === "playoffs" ||
      f.competition === "friendly" ||
      f.competition === "world_club_challenge"
    );
  });

  for (const fixture of extras) {
    items.push({
      kind: "played",
      key: fixture.fixtureId ?? `extra-${fixture.round}-${fixture.opponent}`,
      fixture,
      competition: fixture.competition,
      selectable: true,
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
  if (wccCurrent?.status === "scheduled" && wccCurrent.userInvolved) {
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

  for (const result of career.worldClubChallenge?.history ?? []) {
    // Past WCC only belongs in the WCC tab — skip previous seasons here.
    if (result.seasonYear !== career.seasonYear) continue;
    // AI showcase (user not involved) stays on the WCC tab only.
    if (result.userResult === "not_involved") continue;
    if (matchedFixtureIds.has(result.id)) continue;
    const alreadyListed = items.some(
      (i) =>
        i.kind === "played" &&
        (i.fixture.fixtureId === result.id || i.key === result.id)
    );
    if (alreadyListed) continue;
    matchedFixtureIds.add(result.id);
    items.push({
      kind: "played",
      key: result.id,
      fixture: worldClubChallengeResultToFixtureRecord(result, career.club),
      competition: "world_club_challenge",
      selectable: false,
    });
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
  compact = false,
}: {
  sched: ManagerScheduledFixture;
  club: string;
  isNext: boolean;
  compact?: boolean;
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

  return (
    <div
      className={`${managerFixtureRowClass({
        isNext,
        competition: sched.competition,
        hasFriendlyStyle: false,
      })}${compact ? " !py-2" : ""}`}
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
  compact = false,
}: {
  item: Extract<FixtureListItem, { kind: "played" }>;
  club: string;
  onSelectFixture: (fixtureId: string) => void;
  compact?: boolean;
}) {
  const { fixture } = item;
  const fixtureId = managerFixtureDisplayId(fixture);
  const attendance = fixture.meta?.attendance?.attendance;
  const userTeamName = fixture.userClub || club;
  const selectable = item.selectable !== false;

  return (
    <div className={compact ? "space-y-1" : SPACING.stackSm}>
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
          <span className="shrink-0 text-[0.72rem] leading-snug text-pitch-500">
            Attendance {attendance.toLocaleString()}
          </span>
        )}
      </div>
      <FixtureResultRow
        fixture={fixture}
        userTeamName={userTeamName}
        roundLabel={getManagerPlayedFixtureLabel(fixture)}
        cupHighlight={isChallengeCupFixture(fixture.competition)}
        onClick={
          selectable
            ? () => {
                playUiClick();
                onSelectFixture(fixtureId);
              }
            : undefined
        }
      />
    </div>
  );
}

function FixtureItemList({
  items,
  club,
  onSelectFixture,
  compact = false,
}: {
  items: FixtureListItem[];
  club: string;
  onSelectFixture: (fixtureId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1.5" : SPACING.stackSm}>
      {items.map((item) =>
        item.kind === "upcoming" ? (
          <UpcomingFixtureRow
            key={item.key}
            sched={item.sched}
            club={club}
            isNext={item.isNext}
            compact={compact}
          />
        ) : (
          <PlayedFixtureRow
            key={item.key}
            item={item}
            club={club}
            onSelectFixture={onSelectFixture}
            compact={compact}
          />
        )
      )}
    </div>
  );
}

export function ManagerFixtures({
  career,
  onSelectFixture,
  onUpdate,
  initialFilter = "calendar",
  onOpenMatchPrep,
}: ManagerFixturesProps) {
  const [filter, setFilter] = useState<FixtureFilter>(initialFilter);
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

  const allItems = useMemo(
    () => buildFixtureList(career, nextFixture),
    [career, nextFixture]
  );

  const filteredItems = useMemo(() => {
    let items = allItems.filter((item) =>
      matchesCompetitionFilter(itemCompetition(item), filter)
    );

    if (filter === "results") {
      items = sortResultsNewestFirst(items.filter((i) => i.kind === "played"));
    }

    return items;
  }, [allItems, filter]);

  const upcomingItems = useMemo(
    () =>
      sortUpcomingFirst(
        filteredItems.filter((i) => i.kind === "upcoming")
      ),
    [filteredItems]
  );

  const challengeCupItems = useMemo(
    () =>
      sortUpcomingFirst(
        filteredItems.filter(
          (i) => i.kind === "upcoming" && itemCompetition(i) === "challenge_cup"
        )
      ),
    [filteredItems]
  );

  const leagueUpcomingItems = useMemo(
    () =>
      sortUpcomingFirst(
        upcomingItems.filter(
          (i) =>
            i.kind === "upcoming" &&
            (i.sched.competition === "league" || !i.sched.competition)
        )
      ),
    [upcomingItems]
  );

  const playoffItems = useMemo(
    () =>
      sortUpcomingFirst(
        filteredItems.filter(
          (i) => i.kind === "upcoming" && itemCompetition(i) === "playoffs"
        )
      ),
    [filteredItems]
  );

  /** Filter past-season / non-user WCC out of normal Results / All lists. */
  const filterNormalPlayed = useCallback(
    (items: FixtureListItem[]) => {
      const currentUserWcc = getLatestUserWorldClubChallengeResult(career);
      const currentWccId = currentUserWcc?.id;
      let sawCurrentWcc = false;
      return items.filter((i) => {
        if (i.kind !== "played") return true;
        if (itemCompetition(i) !== "world_club_challenge") return true;
        const id = i.fixture.fixtureId ?? i.key;
        const historyEntry = career.worldClubChallenge?.history?.find(
          (r) => r.id === id
        );
        if (historyEntry?.userResult === "not_involved") return false;
        if (
          !historyEntry &&
          i.fixture.userClub != null &&
          i.fixture.userClub !== career.club
        ) {
          return false;
        }
        const isCurrent =
          id === currentWccId ||
          (currentWccId == null &&
            career.fixtures.some(
              (f) =>
                f.competition === "world_club_challenge" &&
                (f.fixtureId === id || f.fixtureId === i.key) &&
                (f.userClub == null || f.userClub === career.club)
            ));
        if (!isCurrent) return false;
        if (sawCurrentWcc) return false;
        sawCurrentWcc = true;
        return true;
      });
    },
    [career]
  );

  /** All = scheduled + completed, chronological by round. */
  const allTabItems = useMemo(() => {
    if (filter !== "all") return [];
    return filterNormalPlayed(filteredItems).sort(
      (a, b) => itemRound(a) - itemRound(b)
    );
  }, [filteredItems, filter, filterNormalPlayed]);

  /** Completed fixtures only under Results — never inside upcoming sections.
   *  Current-season WCC may appear once; past WCC stays in the WCC tab only. */
  const completedResultsItems = useMemo(() => {
    if (filter !== "results") return [];
    return sortResultsNewestFirst(
      filterNormalPlayed(filteredItems.filter((i) => i.kind === "played"))
    );
  }, [filteredItems, filter, filterNormalPlayed]);

  const showAllCombined = filter === "all" && allTabItems.length > 0;
  const showChallengeCup = filter === "cup";
  const showSuperLeague = filter === "league";
  const showPlayoffs = filter === "playoffs" && playoffItems.length > 0;
  const showCompletedResults =
    filter === "results" && completedResultsItems.length > 0;

  const wccStats = getWccStats(career);
  const wccCurrentRaw = career.worldClubChallenge?.currentFixture;
  const wccScheduled =
    wccCurrentRaw?.status === "scheduled"
      ? resolveWccFixtureForDisplay(career, wccCurrentRaw)
      : null;
  const wccCurrentSeasonResult = getCurrentSeasonWccResult(career);
  const wccPastResults = useMemo(
    () =>
      wccStats.results
        .filter((r) => r.seasonYear !== career.seasonYear)
        .slice()
        .reverse(),
    [wccStats.results, career.seasonYear]
  );
  const showWcc = filter === "wcc";

  const wccPastResultsList =
    wccPastResults.length > 0 ? (
      <ul className={SPACING.stackSm}>
        {wccPastResults.map((r) => (
          <li key={r.id}>
            <WccResultBox
              result={r}
              club={career.club}
              compact={false}
            />
          </li>
        ))}
      </ul>
    ) : null;

  let wccPanelContent: ReactNode = null;
  if (filter === "wcc") {
    wccPanelContent = (
      <div className="space-y-4">
        {wccScheduled ? (
          <div className="space-y-2">
            <p className={`${TYPO.sectionLabel} text-sky-300`}>This season</p>
            <WccScheduledBox
              wcc={wccScheduled}
              club={career.club}
              isNext={nextFixture?.id === wccScheduled.id}
              compact={false}
            />
            <p className={TYPO.bodySm}>
              Game Week {wccScheduled.gameWeek} · Season {wccScheduled.seasonYear}
              {wccScheduled.userInvolved
                ? ` · NRL rating ${wccScheduled.nrlChampionRating}`
                : ""}
            </p>
            {wccScheduled.userInvolved ? (
              <p className={`${TYPO.bodySm} text-accent-gold`}>
                {career.seasonHistory.length === 0
                  ? "Season invitation — face a top-tier NRL club. Play or Simulate from Matchday when Game Week 3 arrives."
                  : "You are the Super League champion — Play or Simulate from Matchday when Game Week 3 arrives."}
              </p>
            ) : (
              <p className={TYPO.bodySm}>
                {career.seasonHistory.length === 0
                  ? "Season-one showcase — a top-tier Super League club faces the NRL. The AI result appears after Game Week 3."
                  : "Another Super League club is involved this year — the AI result appears after Game Week 3."}
              </p>
            )}
          </div>
        ) : wccCurrentSeasonResult ? (
          <div className="space-y-2">
            <p className={`${TYPO.sectionLabel} text-sky-300`}>This season</p>
            <WccResultBox
              result={wccCurrentSeasonResult}
              club={career.club}
              defaultOpen={false}
              compact={false}
            />
          </div>
        ) : wccPastResults.length > 0 || wccStats.results.length > 0 ? (
          <p className={TYPO.bodySm}>
            No World Club Challenge fixture scheduled this season.
          </p>
        ) : (
          <p className={TYPO.bodySm}>
            The World Club Challenge is scheduled each season — season one is a
            top-tier Super League vs NRL showcase (AI result); later seasons
            feature the Grand Final winners.
          </p>
        )}
        {wccPastResultsList ? (
          <div className="space-y-2">
            <p className={`${TYPO.sectionLabel} text-sky-300`}>Past results</p>
            {wccPastResultsList}
          </div>
        ) : null}
      </div>
    );
  } else if (wccScheduled) {
    wccPanelContent = (
      <div className="space-y-2">
        <WccScheduledBox
          wcc={wccScheduled}
          club={career.club}
          isNext={nextFixture?.id === wccScheduled.id}
          compact={false}
        />
        <p className={TYPO.bodySm}>
          Game Week {wccScheduled.gameWeek} · Season {wccScheduled.seasonYear}
          {wccScheduled.userInvolved
            ? ` · NRL rating ${wccScheduled.nrlChampionRating}`
            : ""}
        </p>
        {wccScheduled.userInvolved ? (
          <p className={`${TYPO.bodySm} text-accent-gold`}>
            {career.seasonHistory.length === 0
              ? "Season invitation — face a top-tier NRL club. Play or Simulate from Matchday when Game Week 3 arrives."
              : "You are the Super League champion — Play or Simulate from Matchday when Game Week 3 arrives."}
          </p>
        ) : (
          <p className={TYPO.bodySm}>
            {career.seasonHistory.length === 0
              ? "Season-one showcase — a top-tier Super League club faces the NRL (AI match)."
              : "Another Super League club is involved this year."}
          </p>
        )}
      </div>
    );
  }

  const showNextMatch =
    nextFixture &&
    !seasonComplete &&
    shouldShowNextMatch(filter, nextFixture);

  const nextMatchOccasion = showNextMatch
    ? getManagerMatchOccasionPresentation(nextFixture)
    : null;

  const hasCupBracket =
    showChallengeCup && getCupBracketForDisplay(career) != null;

  const hasAnySection =
    showNextMatch ||
    showAllCombined ||
    (showWcc && wccPanelContent) ||
    hasCupBracket ||
    (showChallengeCup && challengeCupItems.length > 0) ||
    (showSuperLeague && leagueUpcomingItems.length > 0) ||
    showPlayoffs ||
    showCompletedResults;

  return (
    <ManagerPage>
      <ManagerSection className="manager-fixtures">
      <GameSectionHeader
        size="page"
        label="Fixtures"
        title="Fixtures"
        subtitle={
          filter === "calendar"
            ? `Season ${career.seasonYear} · select a date to review fixtures or sim forward`
            : `Season ${career.seasonYear} · ${career.club}`
        }
      />

      <div className="flex w-full min-w-0 justify-center">
        <ManagerSubTabBar
          tabs={FILTERS}
          active={filter}
          onChange={setFilter}
          scrollable
          ariaLabel="Fixtures views"
        />
      </div>

      {filter === "calendar" ? (
        onUpdate ? (
          <ManagerCalendar career={career} onUpdate={onUpdate} embedded />
        ) : (
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Calendar is unavailable in this view.
          </p>
        )
      ) : (
      <div className="flex w-full min-w-0 flex-col gap-4 sm:gap-5">
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
            {nextMatchOccasion.occasion !== "wcc" ? (
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
            ) : null}
          </div>
          <p className="fixture-matchup-title mt-2 font-[family-name:var(--font-pitch)] text-base font-bold uppercase tracking-wide leading-snug text-white sm:text-xl">
            <span title={career.club}>{career.club}</span>
            <span className="text-pitch-500">
              {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
            </span>
            <span title={nextFixture.opponent}>{nextFixture.opponent}</span>
          </p>
          {nextMatchOccasion.momentLine ? (
            <p
              className={`mt-2 text-sm font-semibold ${nextMatchOccasion.momentTextClass}`}
            >
              {nextMatchOccasion.momentLine}
            </p>
          ) : null}
          <p className={`mt-1 break-words ${TYPO.bodySm} text-pitch-400`}>
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
        <GamePanel padded label="WCC">
          {wccPanelContent}
        </GamePanel>
      )}

      {showAllCombined && (
        <GamePanel padded label={`All fixtures (${allTabItems.length})`}>
          <FixtureItemList
            items={allTabItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
            compact={false}
          />
        </GamePanel>
      )}

      {showChallengeCup && hasCupBracket && (
        <GamePanel padded label="Challenge Cup Bracket">
          <ManagerChallengeCupBracket
            career={career}
            variant="full"
            onOpenMatchReview={onSelectFixture}
            onOpenMatchPrep={onOpenMatchPrep}
          />
        </GamePanel>
      )}

      {showChallengeCup && !hasCupBracket && challengeCupItems.length > 0 && (
        <GamePanel
          padded
          label={`Challenge Cup (${challengeCupItems.length})`}
        >
          <FixtureItemList
            items={challengeCupItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
            compact={false}
          />
        </GamePanel>
      )}

      {showSuperLeague && leagueUpcomingItems.length > 0 && (
        <GamePanel
          padded
          label={getManagerFixtureSectionLabel("league", leagueUpcomingItems.length)}
        >
          <FixtureItemList
            items={leagueUpcomingItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
            compact={false}
          />
        </GamePanel>
      )}

      {showPlayoffs && (
        <GamePanel padded label={`Play-offs (${playoffItems.length})`}>
          <FixtureItemList
            items={playoffItems}
            club={career.club}
            onSelectFixture={onSelectFixture}
            compact={false}
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
            compact={false}
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
      )}
      </ManagerSection>
    </ManagerPage>
  );
}
