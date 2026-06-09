import type { MatchFixture } from "./game/season-simulation";
import { getOpponentSquadValue } from "./game/opponent-scorers";

export interface TeamValueEntry {
  name: string;
  value: number;
}

export function getMostExpensiveTeam(
  userTeamName: string,
  userValue: number,
  fixtures: MatchFixture[],
  seed: string
): TeamValueEntry {
  const teams = new Map<string, number>();
  teams.set(userTeamName, userValue);

  for (const fixture of fixtures) {
    const oppValue = getOpponentSquadValue(
      fixture.opponent,
      seed,
      fixture.round
    );
    const prev = teams.get(fixture.opponent) ?? 0;
    teams.set(fixture.opponent, Math.max(prev, oppValue));
  }

  let best: TeamValueEntry = { name: userTeamName, value: userValue };
  for (const [name, value] of teams) {
    if (value > best.value) best = { name, value };
  }
  return best;
}
