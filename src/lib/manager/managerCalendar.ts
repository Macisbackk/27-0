import type {
  ManagerCareer,
  ManagerCompetition,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "./types";
import { MANAGER_SEASON_GAMES } from "./types";
import { areRivalClubs } from "./managerRivals";
import { isMagicWeekendFixture, MAGIC_WEEKEND_ROUND } from "./managerMagicWeekend";

export type CalendarHighlightKind =
  | "league"
  | "rival"
  | "magic_weekend"
  | "challenge_cup"
  | "wcc"
  | "playoff"
  | "season_finale";

export interface ManagerCalendarEvent {
  id: string;
  /** Local calendar date YYYY-MM-DD */
  dateKey: string;
  year: number;
  month: number; // 1–12
  day: number;
  label: string;
  opponent: string;
  competition: ManagerCompetition | "world_club_challenge";
  highlight: CalendarHighlightKind;
  /** League round / WCC game week used for sim-to-date targeting. */
  progressGameWeek: number;
  played: boolean;
  result?: "W" | "L" | "D";
  scoreline?: string;
  isHome?: boolean;
  fixtureId?: string;
}

const CUP_MIDWEEK_AFTER_LEAGUE = [3, 7, 12, 17, 22, 26] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(year: number, month: number, day: number, delta: number): {
  year: number;
  month: number;
  day: number;
  dateKey: string;
} {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  return { year: y, month: m, day: dd, dateKey: toDateKey(y, m, dd) };
}

/** First Saturday on or after 1 Feb of the Super League season year. */
export function getSeasonCalendarStart(seasonYear: number): {
  year: number;
  month: number;
  day: number;
  dateKey: string;
} {
  const d = new Date(Date.UTC(seasonYear, 1, 1)); // 1 Feb
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  const delta = dow === 6 ? 0 : (6 - dow + 7) % 7;
  return addDays(seasonYear, 2, 1, delta);
}

function leagueRoundDate(
  seasonYear: number,
  round: number
): { year: number; month: number; day: number; dateKey: string } {
  const start = getSeasonCalendarStart(seasonYear);
  return addDays(start.year, start.month, start.day, (round - 1) * 7);
}

function highlightForFixture(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture,
  isLastLeague: boolean
): CalendarHighlightKind {
  if (fixture.competition === "world_club_challenge") return "wcc";
  if (fixture.competition === "challenge_cup") return "challenge_cup";
  if (fixture.competition === "playoffs") return "playoff";
  if (isMagicWeekendFixture(fixture) || fixture.round === MAGIC_WEEKEND_ROUND) {
    return "magic_weekend";
  }
  if (isLastLeague) return "season_finale";
  if (areRivalClubs(career.club, fixture.opponent)) return "rival";
  return "league";
}

function findPlayedRecord(
  career: ManagerCareer,
  fixture: ManagerScheduledFixture
): ManagerFixtureRecord | undefined {
  return career.fixtures.find(
    (f) =>
      f.fixtureId === fixture.id ||
      (f.competition === fixture.competition &&
        f.round === fixture.round &&
        f.opponent === fixture.opponent)
  );
}

/**
 * Build the season calendar for the user's club — league Saturdays plus cup /
 * WCC midweeks as the campaign progresses.
 */
export function buildManagerSeasonCalendar(
  career: ManagerCareer
): ManagerCalendarEvent[] {
  const events: ManagerCalendarEvent[] = [];
  const seasonYear = career.seasonYear;
  const schedule = career.schedule ?? [];
  const lastLeagueRound = Math.max(
    MANAGER_SEASON_GAMES,
    ...schedule.map((f) => f.round)
  );

  for (const fixture of schedule) {
    const when = leagueRoundDate(seasonYear, fixture.round);
    const isLast = fixture.round === lastLeagueRound;
    const playedRec = findPlayedRecord(career, fixture);
    const highlight = highlightForFixture(career, fixture, isLast);
    events.push({
      id: fixture.id,
      dateKey: when.dateKey,
      year: when.year,
      month: when.month,
      day: when.day,
      label:
        highlight === "magic_weekend"
          ? "Magic Weekend"
          : highlight === "season_finale"
            ? "Final round"
            : highlight === "rival"
              ? "Rivalry"
              : "League",
      opponent: fixture.opponent,
      competition: fixture.competition ?? "league",
      highlight,
      progressGameWeek: fixture.round,
      played: Boolean(playedRec),
      result: playedRec?.result,
      scoreline: playedRec
        ? `${playedRec.pointsFor}-${playedRec.pointsAgainst}`
        : undefined,
      isHome: fixture.isHome,
      fixtureId: fixture.id,
    });
  }

  // World Club Challenge — Friday before round 3 Saturday (showcase / user).
  const wccRoundDate = leagueRoundDate(seasonYear, 3);
  const wccWhen = addDays(wccRoundDate.year, wccRoundDate.month, wccRoundDate.day, -1);
  const wccCurrent = career.worldClubChallenge?.currentFixture;
  const wccHistory = career.worldClubChallenge?.history?.find(
    (r) => r.seasonYear === seasonYear
  );
  if (wccCurrent || wccHistory) {
    const sl =
      wccHistory?.superLeagueChampionName ??
      wccCurrent?.superLeagueChampionName ??
      "Super League";
    const nrl =
      wccHistory?.nrlChampionName ?? wccCurrent?.nrlChampionName ?? "NRL";
    const involved =
      wccCurrent?.userInvolved === true ||
      (wccHistory != null && wccHistory.userResult !== "not_involved");
    events.push({
      id: `wcc-${seasonYear}`,
      dateKey: wccWhen.dateKey,
      year: wccWhen.year,
      month: wccWhen.month,
      day: wccWhen.day,
      label: involved ? "World Club Challenge" : "WCC (AI)",
      opponent: involved ? nrl : `${sl} vs ${nrl}`,
      competition: "world_club_challenge",
      highlight: "wcc",
      progressGameWeek: 3,
      played: Boolean(wccHistory),
      result:
        wccHistory?.userResult === "won"
          ? "W"
          : wccHistory?.userResult === "lost"
            ? "L"
            : undefined,
      scoreline: wccHistory
        ? `${wccHistory.homeScore}-${wccHistory.awayScore}`
        : undefined,
      isHome: true,
      fixtureId: wccCurrent?.id ?? `wcc-${seasonYear}`,
    });
  }

  // Challenge Cup — midweek after trigger league rounds, using cup fixtures + pending.
  const cupFixtures = career.fixtures.filter(
    (f) => f.competition === "challenge_cup"
  );
  const cupBracket = career.challengeCup?.matches ?? [];
  const cupPlayed = cupFixtures.length;

  CUP_MIDWEEK_AFTER_LEAGUE.forEach((afterLeague, index) => {
    const roundNum = index + 1;
    const anchor = leagueRoundDate(seasonYear, afterLeague);
    const when = addDays(anchor.year, anchor.month, anchor.day, 3); // Tue after Saturday
    const played = cupFixtures[index];
    const pendingUser = cupBracket.find(
      (m) =>
        m.isUserMatch &&
        m.round === roundNum &&
        (m.status === "ready" || m.status === "pending")
    );
    if (!played && !pendingUser && index >= cupPlayed + 1) {
      // Don't show far-future cup ties until nearer — keep next pending + played.
      return;
    }
    if (!played && !pendingUser) return;

    const opponent =
      played?.opponent ??
      (pendingUser
        ? pendingUser.homeTeam === career.club
          ? pendingUser.awayTeam
          : pendingUser.homeTeam
        : "TBD") ??
      "TBD";

    events.push({
      id: played?.fixtureId ?? `cup-r${roundNum}-${seasonYear}`,
      dateKey: when.dateKey,
      year: when.year,
      month: when.month,
      day: when.day,
      label: `Challenge Cup R${roundNum}`,
      opponent: opponent ?? "TBD",
      competition: "challenge_cup",
      highlight: "challenge_cup",
      progressGameWeek: afterLeague,
      played: Boolean(played),
      result: played?.result,
      scoreline: played
        ? `${played.pointsFor}-${played.pointsAgainst}`
        : undefined,
      isHome: played?.isHome,
      fixtureId: played?.fixtureId,
    });
  });

  // Play-off fixtures if present
  for (const f of career.fixtures.filter((x) => x.competition === "playoffs")) {
    const after = lastLeagueRound;
    const anchor = leagueRoundDate(seasonYear, after);
    const offset = Math.max(0, (f.round ?? 1) * 7);
    const when = addDays(anchor.year, anchor.month, anchor.day, 7 + offset);
    events.push({
      id: f.fixtureId ?? `po-${f.round}-${seasonYear}`,
      dateKey: when.dateKey,
      year: when.year,
      month: when.month,
      day: when.day,
      label: "Play-Offs",
      opponent: f.opponent,
      competition: "playoffs",
      highlight: "playoff",
      progressGameWeek: after + (f.round ?? 1),
      played: true,
      result: f.result,
      scoreline: `${f.pointsFor}-${f.pointsAgainst}`,
      isHome: f.isHome,
      fixtureId: f.fixtureId,
    });
  }

  // Deduplicate by id, sort by date
  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function getEventsForDate(
  events: ManagerCalendarEvent[],
  dateKey: string
): ManagerCalendarEvent[] {
  return events.filter((e) => e.dateKey === dateKey);
}

export function getCalendarMonthBounds(
  events: ManagerCalendarEvent[],
  seasonYear: number
): { startMonth: number; startYear: number; endMonth: number; endYear: number } {
  if (events.length === 0) {
    return {
      startMonth: 2,
      startYear: seasonYear,
      endMonth: 10,
      endYear: seasonYear,
    };
  }
  const first = events[0]!;
  const last = events[events.length - 1]!;
  return {
    startMonth: first.month,
    startYear: first.year,
    endMonth: last.month,
    endYear: last.year,
  };
}

/** Target game-week progress for sim-to-date (inclusive). */
export function getSimTargetGameWeekForDate(
  events: ManagerCalendarEvent[],
  dateKey: string
): number | null {
  const onOrBefore = events.filter((e) => e.dateKey <= dateKey);
  if (onOrBefore.length === 0) return null;
  return Math.max(...onOrBefore.map((e) => e.progressGameWeek));
}

/** Calendar date for a career game week (nearest event on or before). */
export function getDateKeyForGameWeek(
  events: ManagerCalendarEvent[],
  gameWeek: number
): string | null {
  const exact = events.find((e) => e.progressGameWeek === gameWeek);
  if (exact) return exact.dateKey;
  const before = events
    .filter((e) => e.progressGameWeek <= gameWeek)
    .sort((a, b) => a.progressGameWeek - b.progressGameWeek);
  if (before.length > 0) return before[before.length - 1]!.dateKey;
  return events[0]?.dateKey ?? null;
}

export const CALENDAR_HIGHLIGHT_STYLES: Record<
  CalendarHighlightKind,
  { chip: string; label: string }
> = {
  league: {
    chip: "border-pitch-600/50 bg-pitch-800/80 text-pitch-200",
    label: "League",
  },
  rival: {
    chip: "border-red-500/45 bg-red-500/15 text-red-200",
    label: "Rival",
  },
  magic_weekend: {
    chip: "border-violet-400/45 bg-violet-500/15 text-violet-200",
    label: "Magic Weekend",
  },
  challenge_cup: {
    chip: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
    label: "Challenge Cup",
  },
  wcc: {
    chip: "border-sky-400/45 bg-sky-500/15 text-sky-200",
    label: "WCC",
  },
  playoff: {
    chip: "border-theme-primary/45 bg-theme-primary/15 text-theme-primary",
    label: "Play-Offs",
  },
  season_finale: {
    chip: "border-amber-400/45 bg-amber-500/15 text-amber-200",
    label: "Finale",
  },
};
