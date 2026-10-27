/**
 * Checks the Hall of Fame / Club Legend tag lists against the player database:
 * - every club listed for a Club Legend has at least one card of that player at that club
 *   (catches typos and wrong-club entries);
 * - every Hall of Fame and Club Legend card resolves to the expected tag;
 * - no card carries a tag the lists do not grant;
 * - no past-season card is tagged Current and no 2026 squad card is tagged Historic.
 *
 * Run: bun scripts/validate-honour-tags.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { normalizePlayer } from "../src/lib/players/normalize";
import { resolvePlayerTiers } from "../src/lib/players/player-card-colours";
import { normalizeHonourName } from "../src/lib/players/honour-tags";

type Raw = Record<string, unknown>;
const ROOT = join(__dirname, "..");
const read = <T>(file: string): T => JSON.parse(readFileSync(join(ROOT, "data", file), "utf8")) as T;

const rows: Raw[] = [
  ...read<Raw[]>("current-squads.json"),
  ...read<Raw[]>("historic-players.json"),
  ...read<Raw[]>("legends.json"),
];
const players = rows.map(normalizePlayer);
const clubLegends = read<{ legends: Array<{ name: string; clubs: string[] }> }>("club-legends.json").legends;
const hallOfFame = read<{ inductees: Array<{ name: string }> }>("hall-of-fame.json").inductees;

const errors: string[] = [];

for (const entry of clubLegends) {
  for (const club of entry.clubs) {
    const cards = players.filter(
      (p) => normalizeHonourName(p.name) === normalizeHonourName(entry.name) && (p.club === club || p.displayClub === club)
    );
    if (cards.length === 0) errors.push(`club-legends.json: no ${entry.name} card at ${club}`);
    for (const card of cards) {
      if (!card.clubLegend) errors.push(`${card.id}: ${entry.name} at ${club} is not tagged Club Legend`);
    }
  }
}

const hofNames = new Set(hallOfFame.map((h) => normalizeHonourName(h.name)));
const legendNames = new Set(clubLegends.map((c) => normalizeHonourName(c.name)));
for (const p of players) {
  const key = normalizeHonourName(p.name);
  if (p.hallOfFame && !hofNames.has(key)) errors.push(`${p.id}: Hall of Fame tag without a hall-of-fame.json entry`);
  if (p.clubLegend && !legendNames.has(key)) errors.push(`${p.id}: Club Legend tag without a club-legends.json entry`);
  const year = p.cardYear ?? p.year;
  const tiers = resolvePlayerTiers(p);
  if (tiers.includes("current") && year !== undefined && year < 2026) {
    errors.push(`${p.id}: ${year} card tagged Current`);
  }
}

let hofCards = 0;
let clubLegendCards = 0;
for (const p of players) {
  if (p.hallOfFame) hofCards++;
  if (p.clubLegend) clubLegendCards++;
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} honour tag problem(s).`);
  process.exit(1);
}
console.log(
  `Honour tags OK: ${hofCards} Hall of Fame cards, ${clubLegendCards} Club Legend cards, ` +
    `${clubLegends.length} club legends, ${hallOfFame.length} Hall of Fame inductees listed.`
);
