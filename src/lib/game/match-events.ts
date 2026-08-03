export type MatchEventType =
  | "try"
  | "conversion"
  | "goal"
  | "missed_conversion"
  | "penalty_goal"
  | "penalty"
  | "drop_goal"
  | "big_break"
  | "line_break"
  | "try_saver"
  | "knock_on"
  | "forward_pass"
  | "six_again"
  | "goal_line_dropout"
  | "captains_challenge"
  | "sin_bin"
  | "injury"
  | "interchange"
  | "momentum_shift"
  | "pressure_set"
  | "last_tackle_kick"
  | "forty_twenty"
  | "forced_error"
  | "held_up"
  | "missed_drop_goal"
  | "note"
  | "half_time"
  | "full_time";

export type MatchEventImportance = "low" | "medium" | "high" | "major";

export type MatchEventTerritory =
  | "own_end"
  | "middle"
  | "opposition_20"
  | "goal_line";

export interface MatchEvent {
  id: string;
  minute: number;
  teamId: string;
  teamName: string;
  opponentTeamId?: string;
  opponentTeamName?: string;
  playerId?: string;
  playerName?: string;
  kickerId?: string;
  kickerName?: string;
  type: MatchEventType;
  points?: number;
  description: string;
  importance: MatchEventImportance;
  possessionTeamId?: string;
  territory?: MatchEventTerritory;
  relatedEventId?: string;
}

export function isScoringEventType(type: MatchEventType): boolean {
  return (
    type === "try" ||
    type === "conversion" ||
    type === "goal" ||
    type === "penalty_goal" ||
    type === "penalty" ||
    type === "drop_goal"
  );
}

export function isConversionType(type: MatchEventType): boolean {
  return type === "conversion" || type === "goal";
}

export function eventMinutePrefix(minute: number, description: string): string {
  const prefix = `${minute}'`;
  return description.startsWith(prefix) ? description : `${minute}' ${description}`;
}

export function stripEventMinutePrefix(
  description: string,
  minute: number
): string {
  const prefix = `${minute}'`;
  if (!description.startsWith(prefix)) return description;
  return description.slice(prefix.length).trimStart();
}

/** Loose legacy / live event shapes accepted before normalisation. */
export type LegacyMatchEventInput = {
  id?: string;
  matchId?: string;
  minute?: number | string;
  sequence?: number;
  type?: string;
  teamId?: string;
  team?: string;
  teamName?: string;
  opponentTeamId?: string;
  opponentTeamName?: string;
  playerId?: string;
  playerName?: string;
  secondaryPlayerId?: string;
  kickerId?: string;
  kickerName?: string;
  points?: number;
  description?: string;
  importance?: MatchEventImportance;
  possessionTeamId?: string;
  territory?: MatchEventTerritory;
  relatedEventId?: string;
  metadata?: Record<string, unknown>;
};

const MATCH_EVENT_TYPES = new Set<string>([
  "try",
  "conversion",
  "goal",
  "missed_conversion",
  "penalty_goal",
  "penalty",
  "drop_goal",
  "big_break",
  "line_break",
  "try_saver",
  "knock_on",
  "forward_pass",
  "six_again",
  "goal_line_dropout",
  "captains_challenge",
  "sin_bin",
  "injury",
  "interchange",
  "momentum_shift",
  "pressure_set",
  "last_tackle_kick",
  "forty_twenty",
  "forced_error",
  "held_up",
  "missed_drop_goal",
  "note",
  "half_time",
  "full_time",
  "red_card",
  "substitution",
]);

function coerceMinute(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

function resolveTeamId(
  raw: LegacyMatchEventInput,
  userTeamId: string,
  opponentTeamId: string
): string {
  if (typeof raw.teamId === "string" && raw.teamId.trim()) return raw.teamId;
  if (raw.team === "user") return userTeamId;
  if (raw.team === "opponent") return opponentTeamId;
  if (typeof raw.teamName === "string" && raw.teamName.trim()) {
    return raw.teamName;
  }
  return userTeamId;
}

/**
 * Normalise legacy Quick Mode / Manager / saved events into one canonical shape.
 * Invalid rows are skipped (dev-logged); one bad event must not crash the story.
 */
export function normalizeMatchEvents(
  events: LegacyMatchEventInput[] | null | undefined,
  options: {
    matchId: string;
    userTeamId: string;
    opponentTeamId: string;
    userTeamName?: string;
    opponentTeamName?: string;
  }
): MatchEvent[] {
  if (!events || events.length === 0) return [];

  const normalised: MatchEvent[] = [];
  const seenIds = new Set<string>();

  events.forEach((raw, index) => {
    try {
      const minute = coerceMinute(raw.minute);
      if (minute == null) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[match-events] skip event with invalid minute", raw);
        }
        return;
      }

      let type = typeof raw.type === "string" ? raw.type : "note";
      if (type === "red_card") type = "sin_bin";
      if (type === "substitution") type = "interchange";
      if (!MATCH_EVENT_TYPES.has(type)) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[match-events] unknown type coerced to note", type);
        }
        type = "note";
      }

      const teamId = resolveTeamId(
        raw,
        options.userTeamId,
        options.opponentTeamId
      );
      const teamName =
        (typeof raw.teamName === "string" && raw.teamName.trim()) ||
        (teamId === options.userTeamId
          ? options.userTeamName ?? options.userTeamId
          : options.opponentTeamName ?? options.opponentTeamId);

      let id =
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id
          : `${options.matchId}-${minute}-${index}-${type}`;
      if (seenIds.has(id)) {
        id = `${id}-${index}`;
      }
      seenIds.add(id);

      const playerName =
        typeof raw.playerName === "string" &&
        raw.playerName.trim() &&
        !/^try scorer$/i.test(raw.playerName)
          ? raw.playerName.trim()
          : undefined;

      normalised.push({
        id,
        minute,
        teamId,
        teamName,
        opponentTeamId: raw.opponentTeamId,
        opponentTeamName: raw.opponentTeamName,
        playerId: raw.playerId,
        playerName,
        kickerId: raw.kickerId ?? raw.secondaryPlayerId,
        kickerName: raw.kickerName,
        type: type as MatchEventType,
        points: typeof raw.points === "number" ? raw.points : undefined,
        description:
          typeof raw.description === "string" && raw.description.trim()
            ? raw.description
            : `${type.replace(/_/g, " ")}`,
        importance: raw.importance ?? "medium",
        possessionTeamId: raw.possessionTeamId,
        territory: raw.territory,
        relatedEventId: raw.relatedEventId,
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[match-events] failed to normalise event", raw, err);
      }
    }
  });

  return [...normalised].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.id.localeCompare(b.id);
  });
}

export function buildMatchStoryFromEvents(
  events: MatchEvent[],
  userTeam?: string
): string {
  if (events.length === 0) return "A tight contest with few clear chances.";

  const playable = events.filter(
    (e) => e.type !== "half_time" && e.type !== "full_time"
  );
  const tries = playable.filter((e) => e.type === "try");
  const sinBins = playable.filter((e) => e.type === "sin_bin");
  const injuries = playable.filter((e) => e.type === "injury");
  const late = playable.filter((e) => e.minute >= 65);
  const lateScore = late.find((e) =>
    ["penalty_goal", "penalty", "drop_goal", "try", "missed_drop_goal"].includes(
      e.type
    )
  );

  const parts: string[] = [];
  const firstTry = tries[0];
  const userName = userTeam ?? firstTry?.teamName;

  if (firstTry && firstTry.minute <= 12) {
    parts.push(`${firstTry.teamName} started quickly`);
  } else if (!firstTry || firstTry.minute >= 28) {
    parts.push("Both sides took time to find their rhythm");
  }

  const turning = playable.find(
    (e, i) =>
      i > 0 &&
      ["sin_bin", "try", "penalty_goal", "drop_goal"].includes(e.type) &&
      e.minute >= 50 &&
      e.minute <= 72
  );
  if (turning) {
    if (turning.type === "sin_bin") {
      parts.push("a sin bin shifted momentum");
    } else if (turning.type === "try") {
      parts.push(
        `${turning.teamName} struck a key blow after half-time`
      );
    } else {
      parts.push(`${turning.teamName} edged ahead from the boot`);
    }
  }

  if (tries.length >= 2) {
    const topScorer = tries.reduce(
      (acc, ev) => {
        const key = ev.playerName ?? ev.teamName;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const standout = Object.entries(topScorer).sort((a, b) => b[1] - a[1])[0];
    if (standout && standout[1] >= 2) {
      parts.push(`${standout[0]} crossed for ${standout[1]} tries`);
    }
  }

  if (sinBins.length > 0 && !parts.some((p) => p.includes("sin bin"))) {
    parts.push("discipline proved costly");
  }
  if (injuries.length > 0) {
    parts.push("injuries disrupted both benches");
  }
  if (lateScore) {
    parts.push("late drama settled it");
  } else if (userName && tries.length > 0) {
    const userTries = tries.filter((t) => t.teamName === userName).length;
    const oppTries = tries.length - userTries;
    if (userTries > oppTries) {
      parts.push(`${userName} finished the stronger`);
    }
  }

  if (parts.length === 0) {
    return "A hard-fought contest decided by fine margins.";
  }

  const sentence = parts.slice(0, 3).join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}
