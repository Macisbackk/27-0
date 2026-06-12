/**
 * Build teamYearRosters from verified player career spans at their listed club.
 * Run: npx tsx scripts/generate-team-year-rosters.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { normalizePlayer } from "../src/lib/players/normalize";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

function parseYearRange(yearsActive: string): { start: number; end: number } | null {
  const normalized = yearsActive.replace(/–/g, "-");
  const parts = normalized.split("-").map((part) => part.trim());
  if (parts.length < 1 || !parts[0]) return null;

  const startMatch = parts[0].match(/(\d{4})/);
  if (!startMatch) return null;
  const start = Number.parseInt(startMatch[1], 10);

  let end = start;
  if (parts.length > 1) {
    if (/present/i.test(parts[1])) {
      end = new Date().getFullYear();
    } else {
      const endMatch = parts[1].match(/(\d{4})/);
      if (endMatch) end = Number.parseInt(endMatch[1], 10);
    }
  }

  if (end < start) return null;
  return { start, end };
}

function buildRosters(): TeamYearRosters {
  const playable = new Set(getPlayableClubNames());
  const rosters: TeamYearRosters = {};

  const rawPlayers = [
    ...(currentSquads as Record<string, unknown>[]),
    ...(historicPlayers as Record<string, unknown>[]),
    ...(legends as Record<string, unknown>[]),
  ];

  for (const raw of rawPlayers) {
    const player = normalizePlayer(raw);
    if (player.availableInGame === false) continue;
    if (!playable.has(player.club)) continue;

    const range = parseYearRange(player.yearsActive);
    if (!range) continue;

    if (!rosters[player.club]) rosters[player.club] = {};

    for (let year = range.start; year <= range.end; year++) {
      const key = String(year);
      if (!rosters[player.club][key]) rosters[player.club][key] = [];
      if (!rosters[player.club][key].includes(player.id)) {
        rosters[player.club][key].push(player.id);
      }
    }
  }

  for (const team of Object.keys(rosters)) {
    for (const year of Object.keys(rosters[team])) {
      rosters[team][year].sort((a, b) => a.localeCompare(b));
    }
  }

  return rosters;
}

const rosters = buildRosters();
const outPath = join(process.cwd(), "data", "team-year-rosters.json");
writeFileSync(outPath, `${JSON.stringify(rosters, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
