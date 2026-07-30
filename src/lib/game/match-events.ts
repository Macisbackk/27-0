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
  playerId?: string;
  playerName?: string;
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

export function buildMatchStoryFromEvents(events: MatchEvent[]): string {
  if (events.length === 0) return "A tight contest with few clear chances.";

  const tries = events.filter((e) => e.type === "try");
  const sinBins = events.filter((e) => e.type === "sin_bin");
  const lateDrama = events.filter((e) => e.minute >= 65);

  const parts: string[] = [];
  const firstTry = tries[0];
  if (firstTry && firstTry.minute <= 15) {
    parts.push(`${firstTry.teamName} started quickly`);
  } else if (firstTry && firstTry.minute >= 30) {
    parts.push("Both sides took time to settle");
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
      parts.push(`${standout[0]} was the standout with ${standout[1]} tries`);
    }
  }

  if (sinBins.length > 0) {
    parts.push("a sin bin shifted momentum");
  }

  const lateScore = lateDrama.find(
    (e) =>
      e.type === "penalty_goal" ||
      e.type === "penalty" ||
      e.type === "drop_goal" ||
      e.type === "try"
  );
  if (lateScore) {
    parts.push("late drama settled it");
  }

  if (parts.length === 0) {
    return "A hard-fought contest decided by fine margins.";
  }

  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}
