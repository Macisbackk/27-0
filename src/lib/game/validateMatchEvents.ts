import type { MatchEvent, MatchEventType } from "./match-events";

export type MatchEventValidationIssue = {
  code: string;
  message: string;
  eventId?: string;
  fixed?: boolean;
};

export type MatchEventValidationResult = {
  events: MatchEvent[];
  issues: MatchEventValidationIssue[];
  scoreFromEvents: { home: number; away: number };
};

const KICKING_TYPES = new Set<MatchEventType>([
  "conversion",
  "goal",
  "missed_conversion",
  "penalty_goal",
  "penalty",
  "drop_goal",
  "missed_drop_goal",
]);

const TRY_POINTS = 4;
const CONVERSION_POINTS = 2;
const PENALTY_POINTS = 2;
const DROP_GOAL_POINTS = 1;

function pointsForType(type: MatchEventType): number | undefined {
  switch (type) {
    case "try":
      return TRY_POINTS;
    case "conversion":
    case "goal":
      return CONVERSION_POINTS;
    case "penalty_goal":
    case "penalty":
      return PENALTY_POINTS;
    case "drop_goal":
      return DROP_GOAL_POINTS;
    case "missed_conversion":
    case "missed_drop_goal":
      return 0;
    default:
      return undefined;
  }
}

function isTeamName(name: string | undefined, teams: string[]): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return teams.some((t) => t.trim().toLowerCase() === n);
}

/** Validate and safely repair match events before save/display. */
export function validateMatchEvents(
  events: MatchEvent[],
  homeTeam: { id: string; name: string },
  awayTeam: { id: string; name: string },
  options?: {
    knownPlayerNames?: Set<string>;
    pickFallbackPlayer?: (teamId: string) => string | undefined;
  }
): MatchEventValidationResult {
  const issues: MatchEventValidationIssue[] = [];
  const teamNames = [homeTeam.name, awayTeam.name];
  const known = options?.knownPlayerNames;
  const repaired: MatchEvent[] = [];
  let sawHalfTime = false;
  let sawFullTime = false;

  for (const raw of events) {
    const event: MatchEvent = { ...raw };
    const teamOk =
      event.teamId === homeTeam.id ||
      event.teamId === awayTeam.id ||
      event.teamName === homeTeam.name ||
      event.teamName === awayTeam.name;

    if (!teamOk) {
      issues.push({
        code: "unknown_team",
        message: `Event ${event.id} has unknown team ${event.teamName}`,
        eventId: event.id,
      });
    }

    if (event.type === "half_time") {
      if (sawHalfTime) {
        issues.push({
          code: "duplicate_half_time",
          message: "Duplicate half_time event removed",
          eventId: event.id,
          fixed: true,
        });
        continue;
      }
      sawHalfTime = true;
    }
    if (event.type === "full_time") {
      if (sawFullTime) {
        issues.push({
          code: "duplicate_full_time",
          message: "Duplicate full_time event removed",
          eventId: event.id,
          fixed: true,
        });
        continue;
      }
      sawFullTime = true;
    }

    if (isTeamName(event.playerName, teamNames)) {
      issues.push({
        code: "player_is_team",
        message: `playerName "${event.playerName}" equals a team name`,
        eventId: event.id,
        fixed: true,
      });
      const fallback = options?.pickFallbackPlayer?.(event.teamId);
      event.playerName = fallback;
      event.playerId = fallback ? event.playerId : undefined;
    }

    if (isTeamName(event.kickerName, teamNames)) {
      issues.push({
        code: "kicker_is_team",
        message: `kickerName "${event.kickerName}" equals a team name`,
        eventId: event.id,
        fixed: true,
      });
      event.kickerName = options?.pickFallbackPlayer?.(event.teamId);
    }

    if (event.type === "try") {
      const placeholder =
        !event.playerName ||
        /^(try scorer|opposition try scorer|unknown)$/i.test(
          event.playerName.trim()
        );
      if (placeholder) {
        const fallback = options?.pickFallbackPlayer?.(event.teamId);
        if (fallback) {
          event.playerName = fallback;
          issues.push({
            code: "try_missing_player",
            message: `Try event missing player — filled with ${fallback}`,
            eventId: event.id,
            fixed: true,
          });
        } else {
          issues.push({
            code: "try_missing_player",
            message: "Try event missing a valid player",
            eventId: event.id,
          });
        }
      }
      // Kickers must not live on try events
      if (event.kickerName) {
        event.kickerName = undefined;
        event.kickerId = undefined;
      }
    }

    if (KICKING_TYPES.has(event.type)) {
      if (!event.kickerName && event.playerName && !isTeamName(event.playerName, teamNames)) {
        // Migrate legacy playerName on kick events into kickerName
        event.kickerName = event.playerName;
        event.playerName = undefined;
        issues.push({
          code: "kicker_migrated",
          message: "Moved kicking playerName to kickerName",
          eventId: event.id,
          fixed: true,
        });
      }
      if (!event.kickerName) {
        const fallback = options?.pickFallbackPlayer?.(event.teamId);
        if (fallback) {
          event.kickerName = fallback;
          issues.push({
            code: "kicker_missing",
            message: `Kick event missing kicker — filled with ${fallback}`,
            eventId: event.id,
            fixed: true,
          });
        }
      }
    }

    if (known && event.playerName && !known.has(event.playerName)) {
      // Soft warning only — NRL/generated names may not be in squad registry
    }

    const expectedPoints = pointsForType(event.type);
    if (expectedPoints !== undefined && event.points !== undefined) {
      if (event.points !== expectedPoints) {
        issues.push({
          code: "impossible_points",
          message: `${event.type} had ${event.points} points; corrected to ${expectedPoints}`,
          eventId: event.id,
          fixed: true,
        });
        event.points = expectedPoints;
      }
    }

    repaired.push(event);
  }

  // Conversion must follow a try by same team (soft check)
  for (let i = 0; i < repaired.length; i++) {
    const ev = repaired[i]!;
    if (ev.type !== "conversion" && ev.type !== "goal" && ev.type !== "missed_conversion") {
      continue;
    }
    const prev = [...repaired.slice(0, i)]
      .reverse()
      .find((e) => e.type === "try" && e.teamId === ev.teamId);
    if (!prev) {
      issues.push({
        code: "conversion_without_try",
        message: `Conversion/miss at ${ev.minute}' has no preceding try for ${ev.teamName}`,
        eventId: ev.id,
      });
    }
  }

  let home = 0;
  let away = 0;
  for (const ev of repaired) {
    const pts = ev.points ?? 0;
    if (pts <= 0) continue;
    if (ev.teamId === homeTeam.id || ev.teamName === homeTeam.name) home += pts;
    else if (ev.teamId === awayTeam.id || ev.teamName === awayTeam.name) away += pts;
  }

  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    for (const issue of issues) {
      // eslint-disable-next-line no-console
      console.warn(`[match-events] ${issue.code}: ${issue.message}`);
    }
  }

  return { events: repaired, issues, scoreFromEvents: { home, away } };
}

export function tryScorersFromEvents(
  events: Array<{ type: string; teamId?: string; team?: string; playerName?: string; teamName?: string }>,
  teamKey: string
): string[] {
  return events
    .filter((e) => {
      if (e.type !== "try") return false;
      return (
        e.teamId === teamKey ||
        e.team === teamKey ||
        e.teamName === teamKey
      );
    })
    .map((e) => e.playerName)
    .filter((n): n is string => Boolean(n));
}

export function kickingEventsFromEvents<T extends { type: string }>(
  events: T[]
): T[] {
  return events.filter((e) => KICKING_TYPES.has(e.type as MatchEventType));
}
