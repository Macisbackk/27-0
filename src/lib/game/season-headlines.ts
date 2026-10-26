/**
 * End-of-season awards and headlines for the season review.
 *
 * Built only from what the season sim records (per-player season tries, the squad's ratings
 * and each fixture's score / upset flag) — no invented stats. There is no per-player goal
 * data in a Classic season, so there is no Golden Boot. Deterministic: the same season
 * result always gives the same awards and headlines.
 */
import type { SquadSlot, Position } from "../types";
import type { MatchFixture, SeasonResult } from "./season-simulation";
import { getEffectivePeakRating } from "../squad-analysis";

export interface EndOfSeasonAward {
  id: "player-of-season" | "top-try-scorer" | "top-forward" | "highest-rated";
  title: string;
  playerName: string;
  detail: string;
}

export interface SeasonHeadline {
  id: "biggest-win" | "heaviest-defeat" | "perfect" | "win-streak" | "giant-killing" | "upset-loss" | "slump" | "finish";
  text: string;
}

const FORWARDS = new Set<Position>(["PROP", "HOOKER", "SECOND_ROW", "LOOSE_FORWARD"]);

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}

/**
 * Three awards. Player of the Season comes from the review's existing award logic
 * (`playerOfSeason`, from lib/season-awards) so the two never disagree.
 */
export function buildEndOfSeasonAwards(
  squad: SquadSlot[],
  result: Pick<SeasonResult, "tryScorers" | "fixtures">,
  playerOfSeason?: { playerName: string; playerId?: string } | null
): EndOfSeasonAward[] {
  const filled = squad.filter((s) => s.player);
  if (filled.length === 0) return [];
  const triesById = new Map(result.tryScorers.map((t) => [t.playerId, t.tries]));
  const triesFor = (id: string) => triesById.get(id) ?? 0;
  const awards: EndOfSeasonAward[] = [];

  if (playerOfSeason) {
    const slot = filled.find(
      (s) => s.player!.id === playerOfSeason.playerId || s.player!.name === playerOfSeason.playerName
    );
    const tries = slot ? triesFor(slot.player!.id) : 0;
    awards.push({
      id: "player-of-season",
      title: "Player of the Season",
      playerName: playerOfSeason.playerName,
      detail: slot ? `${slot.label} · ${plural(tries, "try")}` : plural(tries, "try"),
    });
  }

  const top = [...result.tryScorers].sort((a, b) => b.tries - a.tries || a.name.localeCompare(b.name))[0];
  if (top && top.tries > 0) {
    const joint = result.tryScorers.filter((t) => t.tries === top.tries).length > 1;
    awards.push({
      id: "top-try-scorer",
      title: joint ? "Joint Top Try Scorer" : "Top Try Scorer",
      playerName: top.name,
      detail: `${plural(top.tries, "try")} in ${result.fixtures.length} games`,
    });
  }

  const forwards = filled
    .filter((s) => FORWARDS.has(s.position))
    .map((s) => ({ slot: s, tries: triesFor(s.player!.id), rating: getEffectivePeakRating(s) }))
    .sort((a, b) => b.tries - a.tries || b.rating - a.rating || a.slot.slotIndex - b.slot.slotIndex);
  const bestForward = forwards[0];
  if (bestForward && bestForward.tries > 0) {
    awards.push({
      id: "top-forward",
      title: "Forward of the Season",
      playerName: bestForward.slot.player!.name,
      detail: `${bestForward.slot.label} · ${plural(bestForward.tries, "try")}`,
    });
  }

  if (awards.length < 3) {
    const taken = new Set(awards.map((a) => a.playerName));
    const rated = filled
      .map((s) => ({ slot: s, rating: getEffectivePeakRating(s) }))
      .sort((a, b) => b.rating - a.rating || a.slot.slotIndex - b.slot.slotIndex);
    const best = rated.find((r) => !taken.has(r.slot.player!.name)) ?? rated[0];
    if (best) {
      awards.push({
        id: "highest-rated",
        title: "Highest Rated",
        playerName: best.slot.player!.name,
        detail: `${best.slot.label} · ${Math.round(best.rating)} OVR`,
      });
    }
  }

  return awards.slice(0, 3);
}

function margin(f: MatchFixture): number {
  return f.pointsFor - f.pointsAgainst;
}

function pickBy(fixtures: MatchFixture[], score: (f: MatchFixture) => number): MatchFixture | null {
  let best: MatchFixture | null = null;
  for (const f of fixtures) {
    if (!best || score(f) > score(best)) best = f;
  }
  return best;
}

/** Two headlines from the season's notable results. */
export function buildSeasonHeadlines(
  result: Pick<
    SeasonResult,
    "fixtures" | "wins" | "losses" | "isPerfect" | "longestWinStreak" | "longestLosingStreak"
  >,
  tablePosition: number
): SeasonHeadline[] {
  const headlines: SeasonHeadline[] = [];
  const wins = result.fixtures.filter((f) => f.result === "W");
  const losses = result.fixtures.filter((f) => f.result === "L");

  const biggestWin = pickBy(wins, margin);
  if (biggestWin) {
    const m = margin(biggestWin);
    const verb = m >= 30 ? "thrashed" : m >= 16 ? "beaten" : "edged out";
    headlines.push({
      id: "biggest-win",
      text: `${biggestWin.opponent} ${verb} ${biggestWin.pointsFor}-${biggestWin.pointsAgainst} in round ${biggestWin.round}`,
    });
  } else {
    const worst = pickBy(losses, (f) => -margin(f));
    if (worst) {
      headlines.push({
        id: "heaviest-defeat",
        text: `Round ${worst.round}: ${worst.opponent} run riot, ${worst.pointsAgainst}-${worst.pointsFor}`,
      });
    }
  }

  const giantKilling = wins.find((f) => f.isUpset);
  const upsetLoss = losses.find((f) => f.isUpset);
  let second: SeasonHeadline | null = null;
  if (result.isPerfect) {
    second = { id: "perfect", text: "27-0: the perfect season" };
  } else if (result.longestWinStreak >= 8) {
    second = { id: "win-streak", text: `Unstoppable: ${result.longestWinStreak} wins on the bounce` };
  } else if (giantKilling) {
    second = {
      id: "giant-killing",
      text: `Giant-killers: ${giantKilling.opponent} stunned ${giantKilling.pointsFor}-${giantKilling.pointsAgainst}`,
    };
  } else if (upsetLoss) {
    second = {
      id: "upset-loss",
      text: `Shock in round ${upsetLoss.round}: ${upsetLoss.opponent} win ${upsetLoss.pointsAgainst}-${upsetLoss.pointsFor}`,
    };
  } else if (result.longestLosingStreak >= 4) {
    second = { id: "slump", text: `Slump: ${result.longestLosingStreak} defeats in a row` };
  }
  if (!second) {
    second = {
      id: "finish",
      text: `${ordinal(tablePosition)} in the table after a ${result.wins}-${result.losses} season`,
    };
  }
  headlines.push(second);
  return headlines.slice(0, 2);
}
