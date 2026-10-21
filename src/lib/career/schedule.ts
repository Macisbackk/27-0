import { shuffle, type Rng } from "./rng";
import type { Division, Fixture, Matchday } from "./types";

/** Circle-method round robin. Returns rounds of [home, away] pairs. */
export function roundRobin(clubIds: string[]): Array<Array<[string, string]>> {
  const teams = [...clubIds];
  if (teams.length % 2 === 1) teams.push("__bye__");
  const n = teams.length;
  const rounds: Array<Array<[string, string]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i]!;
      const b = teams[n - 1 - i]!;
      if (a === "__bye__" || b === "__bye__") continue;
      // Alternate home advantage so each club gets a fair mix.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const fixed = teams[0]!;
    const rest = teams.slice(1);
    rest.unshift(rest.pop()!);
    teams.splice(0, n, fixed, ...rest);
  }
  return rounds;
}

/** After which league round each cup round is played. */
export const CUP_AFTER_ROUND = [4, 9, 14, 19] as const;
export const CUP_ROUND_LABELS = ["Challenge Cup Round 1", "Challenge Cup Round of 16", "Challenge Cup Quarter-final", "Challenge Cup Semi-final", "Challenge Cup Final"] as const;

export const SL_ROUNDS = 26;
export const CHAMP_ROUNDS = 21;

export function buildCalendar(
  rng: Rng,
  year: number,
  divisions: Record<Division, string[]>,
  cupEntrants: string[]
): Matchday[] {
  const sl = roundRobin(shuffle(rng, divisions["super-league"]));
  const slRounds = [...sl, ...sl.map((round) => round.map(([h, a]) => [a, h] as [string, string]))];
  const champRounds = roundRobin(shuffle(rng, divisions.championship));

  const matchdays: Matchday[] = [];
  const push = (label: string, fixtures: Fixture[], pendingDraw?: Matchday["pendingDraw"]) =>
    matchdays.push({ index: matchdays.length, label, fixtures, pendingDraw, played: false });

  const cupFirst = shuffle(rng, cupEntrants);
  const cupR1: Fixture[] = [];
  for (let i = 0; i + 1 < cupFirst.length; i += 2) {
    cupR1.push({
      id: `${year}-cup1-${i / 2}`,
      kind: "cup",
      round: 1,
      label: CUP_ROUND_LABELS[0],
      home: cupFirst[i]!,
      away: cupFirst[i + 1]!,
    });
  }

  for (let r = 1; r <= SL_ROUNDS; r++) {
    const fixtures: Fixture[] = [];
    slRounds[r - 1]!.forEach(([home, away], i) =>
      fixtures.push({ id: `${year}-sl-r${r}-${i}`, kind: "league", round: r, label: `Round ${r}`, division: "super-league", home, away })
    );
    if (r <= champRounds.length) {
      champRounds[r - 1]!.forEach(([home, away], i) =>
        fixtures.push({ id: `${year}-ch-r${r}-${i}`, kind: "league", round: r, label: `Round ${r}`, division: "championship", home, away })
      );
    }
    push(`Round ${r}`, fixtures);
    const cupIndex = CUP_AFTER_ROUND.indexOf(r as (typeof CUP_AFTER_ROUND)[number]);
    if (cupIndex === 0) push(CUP_ROUND_LABELS[0], cupR1);
    else if (cupIndex === 1) push(CUP_ROUND_LABELS[1], [], "cup-r16");
    else if (cupIndex === 2) push(CUP_ROUND_LABELS[2], [], "cup-qf");
    else if (cupIndex === 3) push(CUP_ROUND_LABELS[3], [], "cup-sf");
  }
  push(CUP_ROUND_LABELS[4], [], "cup-final");
  push("Play-off semi-finals & Million Pound Game", [], "playoff-semis");
  push("Super League Grand Final", [], "grand-final");
  return matchdays;
}
