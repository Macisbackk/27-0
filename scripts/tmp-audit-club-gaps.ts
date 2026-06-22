import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { normalizePlayer } from "../src/lib/players/normalize";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player, Position } from "../src/lib/types";

const CLUBS = ["Hull KR", "Leigh Leopards", "York Knights"] as const;

function parseYearsActive(yearsActive: string): { start: number; end: number } | null {
  const years = [...yearsActive.replace(/-/g, "–").matchAll(/(\d{4})/g)].map((m) =>
    Number(m[1])
  );
  if (years.length === 0) return null;
  const start = years[0];
  const end = /present/i.test(yearsActive)
    ? new Date().getFullYear()
    : years.length > 1
      ? years[years.length - 1]
      : start;
  return { start, end };
}

const players = [
  ...(currentSquads as Record<string, unknown>[]),
  ...(historicPlayers as Record<string, unknown>[]),
  ...(legends as Record<string, unknown>[]),
]
  .map(normalizePlayer)
  .filter((p) => p.availableInGame !== false);

for (const club of CLUBS) {
  console.log(`\n=== ${club} ===`);
  for (const year of [1999, 2000, 2017, 2018, 2024]) {
    const roster = players.filter((p) => {
      if (p.club !== club) return false;
      const span = parseYearsActive(p.yearsActive);
      if (!span) return false;
      return year >= span.start && year <= span.end;
    });
    const byPos = new Map<Position, Player[]>();
    for (const p of roster) {
      const list = byPos.get(p.position) ?? [];
      list.push(p);
      byPos.set(p.position, list);
    }
    const gaps: string[] = [];
    for (const { position, count } of SQUAD_STRUCTURE) {
      const have = byPos.get(position)?.length ?? 0;
      if (have < count) gaps.push(`${position}:${have}/${count}`);
    }
    console.log(
      year,
      `players=${roster.length}`,
      gaps.length ? `gaps=[${gaps.join(", ")}]` : "OK"
    );
    if (year === 1999 && club === "Hull KR") {
      console.log(
        "  FB candidates:",
        roster.filter((p) => p.position === "FULLBACK").map((p) => p.name)
      );
    }
    if (year === 2017 && club === "Leigh Leopards") {
      console.log(
        "  FB candidates:",
        roster.filter((p) => p.position === "FULLBACK").map((p) => p.name)
      );
    }
  }
}
