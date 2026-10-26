/**
 * Wordle-style, spoiler-free result text for the end of a Classic / Era / Daily / Weekly season.
 * No player names: just the 27-round grid, record, finish, streak and a link back to the same
 * challenge. Pure (no DOM, no storage) so it can be tested on its own: scripts/test-share-result.ts.
 *
 *   27-0 Daily · 26 Oct · No respins
 *   🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
 *   🟩🟩🟩🟥🟩🟩🟩🟩🟩🟩🟩🟩🟩
 *   Play-offs: 🟩🟩🟩🏆
 *   26-1 · League Leaders · 🏆 Grand Final
 *   🔥 6-day streak
 *   www.27-0.co.uk/play?daily=1
 */

export type ShareMatchResult = "W" | "L" | "D";

export type SharePlayoffFinish =
  | "Super League Champions"
  | "Grand Final Runner-Up"
  | "Eliminated in Semi-Final"
  | "Eliminated in Eliminator"
  | "Missed Play-Offs";

export type ShareResultKind = "classic" | "daily" | "weekly";

export interface ShareResultInput {
  kind: ShareResultKind;
  /** Era squads / Era Daily / Era Weekly. */
  era?: boolean;
  /** Overrides the mode name in the title (e.g. "GOAT Mode"). */
  modeLabel?: string;
  /** Daily: the UK date key, "2026-10-26". */
  dateKey?: string;
  /** Weekly: the week key, "2026-W43". */
  weekKey?: string;
  /** Daily / Weekly rule title, e.g. "No respins". */
  ruleTitle?: string;
  /** A practice run (Daily / Weekly attempt already used). */
  practice?: boolean;
  /** Regular-season results in round order (27 for a full season). */
  results: readonly ShareMatchResult[];
  /** Final league position (1 = League Leaders). */
  leaguePosition: number;
  /** Play-off results in order; omit / empty when the play-offs weren't played. */
  playoffResults?: readonly ShareMatchResult[] | null;
  playoffFinish?: SharePlayoffFinish | null;
  /** Weekly board score for this run. */
  weeklyScore?: number | null;
  /** Daily streak (shown when > 0). */
  streak?: number;
  /** Site-relative link that opens the same challenge ("/play?daily=1"); omitted = the site. */
  href?: string | null;
  /**
   * "Challenge a mate": a site-relative `/play?challenge=<code>` link. When set it replaces the
   * usual link (for every kind, Classic included) under a "Beat my 24-3" line.
   */
  challengeHref?: string | null;
  /** Daily pick rarity: the run's least-picked card ("Rarest pick: Name 0.4%"). */
  rarestPick?: { name: string; percentLabel: string } | null;
}

export const SHARE_SITE = "www.27-0.co.uk";

const SQUARE: Record<ShareMatchResult, string> = {
  W: "🟩",
  L: "🟥",
  D: "🟨",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function resultSquares(results: readonly ShareMatchResult[]): string {
  return results.map((r) => SQUARE[r] ?? "⬜").join("");
}

/** The regular-season grid on two lines: 14 + 13 for 27 rounds (first line takes the odd one). */
export function resultGridLines(results: readonly ShareMatchResult[]): string[] {
  if (results.length === 0) return [];
  const split = Math.ceil(results.length / 2);
  const lines = [resultSquares(results.slice(0, split))];
  if (results.length > split) lines.push(resultSquares(results.slice(split)));
  return lines;
}

/** "2026-10-26" → "26 Oct". */
export function formatShareDate(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const month = m ? MONTHS[m - 1] : undefined;
  if (!d || !month) return dateKey;
  return `${d} ${month}`;
}

/** "2026-W43" → "Week 43". */
export function formatShareWeek(weekKey: string): string {
  const match = /W(\d{1,2})$/.exec(weekKey);
  return match ? `Week ${Number.parseInt(match[1]!, 10)}` : weekKey;
}

export function formatShareRecord(results: readonly ShareMatchResult[]): string {
  let w = 0;
  let l = 0;
  let d = 0;
  for (const r of results) {
    if (r === "W") w++;
    else if (r === "L") l++;
    else if (r === "D") d++;
  }
  return d > 0 ? `${w}-${l}-${d}` : `${w}-${l}`;
}

export function formatSharePosition(position: number): string {
  if (position === 1) return "League Leaders";
  const v = position % 100;
  const suffix =
    v >= 11 && v <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}

function finishLabel(finish: SharePlayoffFinish): string | null {
  switch (finish) {
    case "Super League Champions":
      return "🏆 Grand Final";
    case "Grand Final Runner-Up":
      return "Grand Final runners-up";
    case "Eliminated in Semi-Final":
      return "Semi-final";
    case "Eliminated in Eliminator":
      return "Eliminator";
    case "Missed Play-Offs":
      return "Missed play-offs";
    default:
      return null;
  }
}

function titleFor(input: ShareResultInput): string {
  const era = input.era ? "Era " : "";
  const name =
    input.modeLabel ??
    (input.kind === "daily"
      ? `${era}Daily`
      : input.kind === "weekly"
        ? `${era}Weekly`
        : `${era}Classic`);
  const parts = [`27-0 ${name}`];
  if (input.kind === "daily" && input.dateKey) parts.push(formatShareDate(input.dateKey));
  if (input.kind === "weekly" && input.weekKey) parts.push(formatShareWeek(input.weekKey));
  if (input.kind !== "classic" && input.ruleTitle) parts.push(input.ruleTitle);
  if (input.practice) parts.push("practice");
  return parts.join(" · ");
}

export function buildShareResultText(input: ShareResultInput): string {
  const lines: string[] = [titleFor(input), ...resultGridLines(input.results)];

  const playoffResults = input.playoffResults ?? [];
  const champion = input.playoffFinish === "Super League Champions";
  if (playoffResults.length > 0) {
    lines.push(`Play-offs: ${resultSquares(playoffResults)}${champion ? "🏆" : ""}`);
  }

  const summary = [formatShareRecord(input.results), formatSharePosition(input.leaguePosition)];
  if (input.playoffFinish && (playoffResults.length > 0 || input.playoffFinish === "Missed Play-Offs")) {
    const label = finishLabel(input.playoffFinish);
    if (label) summary.push(label);
  }
  lines.push(summary.join(" · "));

  if (input.kind === "weekly" && typeof input.weeklyScore === "number") {
    lines.push(`⭐ ${input.weeklyScore.toLocaleString("en-GB")} pts`);
  }
  if (input.kind === "daily" && (input.streak ?? 0) > 0) {
    lines.push(`🔥 ${input.streak}-day streak`);
  }

  if (input.rarestPick && input.rarestPick.name && input.rarestPick.percentLabel) {
    lines.push(`💎 Rarest pick: ${input.rarestPick.name} ${input.rarestPick.percentLabel}`);
  }

  if (input.challengeHref) {
    lines.push(`⚔️ Beat my ${formatShareRecord(input.results)}:`);
  }
  const href = input.challengeHref ?? (input.kind === "classic" ? "" : (input.href ?? ""));
  lines.push(`${SHARE_SITE}${href.startsWith("/") ? href : href ? `/${href}` : ""}`);
  return lines.join("\n");
}
