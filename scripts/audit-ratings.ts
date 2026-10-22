/**
 * Ratings audit (Oct 2026): makes each player's year cards tell a believable career story.
 *
 * Problems it fixes (found by this audit):
 * - year cards rated at a player's peak when he was a teenager or long past it
 *   (e.g. a 20-year-old's card at 97 because the card borrowed his career rating);
 * - cards in a player's best seasons (Dream Team, Man of Steel, Golden Boot) rated well below
 *   his ordinary seasons;
 * - neighbouring seasons 8–15 points apart with nothing to explain it.
 *
 * Model, per player (all his cards grouped by name + birth year):
 *   P     = his best card rating (his peak quality)
 *   E     = his elite seasons: Dream Team, Man of Steel, Golden Boot (from every card's data)
 *   Elite season card  → at least P − 1 (− 2 if 21 or under, − 1 a year past 32)
 *   Other season card  → at most P − age curve − distance from his nearest elite season
 * Only historic and legend year cards change; current (2026) cards are this season's ratings.
 * Raises happen only for elite seasons (evidence); everything else can only come down.
 *
 * Run: bun scripts/audit-ratings.ts [--write]
 * Writes data/player-rating-audit.ts (applied after the manual overrides) and
 * data/player-rating-audit-report.json.
 */
import fs from "node:fs";
import path from "node:path";
import { getShowcasePlayers } from "../src/lib/players";
import { PLAYER_RATING_AUDIT } from "../data/player-rating-audit";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")) as Record<string, number[]>;
const MAN_OF_STEEL = read("man-of-steel-winners.json");
const GOLDEN_BOOT = read("golden-boot-years.json");

/** Ratings before this audit: the game applies the audit, so changed cards read back their "from". */
const all = getShowcasePlayers().map((p) => ({ p, rating: p.peakRating }));
void PLAYER_RATING_AUDIT;
// Previous run's "before" values, so the audit is idempotent.
const reportPath = path.join(ROOT, "data", "player-rating-audit-report.json");
if (fs.existsSync(reportPath)) {
  const prev = JSON.parse(fs.readFileSync(reportPath, "utf8")) as { changes: Array<{ id: string; from: number }> };
  const base: Record<string, number> = {};
  for (const c of prev.changes) base[c.id] = c.from;
  for (const row of all) if (base[row.p.id] !== undefined) row.rating = base[row.p.id]!;
}

function ageCurve(age: number): number {
  if (age <= 19) return 7;
  if (age === 20) return 5;
  if (age === 21) return 4;
  if (age === 22) return 2;
  if (age === 23) return 1;
  if (age <= 32) return 0;
  if (age === 33) return 1;
  if (age === 34) return 2;
  if (age === 35) return 3;
  return 4;
}
const elitePenalty = (age: number) => (age <= 21 ? 2 : age >= 33 ? age - 32 : 0);

type Row = (typeof all)[number];
const groups = new Map<string, Row[]>();
for (const row of all) {
  const key = `${row.p.name.toLowerCase()}|${row.p.birthYear ?? "?"}`;
  groups.set(key, [...(groups.get(key) ?? []), row]);
}

type Change = { id: string; name: string; year: number | undefined; club: string; age: number | null; from: number; to: number; why: string };
const changes: Change[] = [];
const out: Record<string, number> = {};

for (const rows of groups.values()) {
  if (rows.length < 2) continue;
  const elite = new Set<number>();
  for (const { p } of rows) {
    for (const y of p.dreamTeamYears ?? []) elite.add(y);
    for (const y of MAN_OF_STEEL[p.id] ?? []) elite.add(y);
    for (const y of GOLDEN_BOOT[p.id] ?? []) elite.add(y);
    for (const y of p.goldenBootYears ?? []) elite.add(y);
  }
  const peak = Math.max(...rows.map((r) => r.rating));
  for (const { p, rating } of rows) {
    if (p.category === "current") continue;
    const year = p.year ?? p.cardYear;
    if (!year) continue;
    const age = p.birthYear ? year - p.birthYear : null;
    let to = rating;
    let why = "";
    if (elite.has(year)) {
      const floor = Math.min(99, peak - 1 - (age === null ? 0 : elitePenalty(age)));
      if (rating < floor) {
        to = floor;
        why = `elite season (${[...elite].sort().join(", ")}); peak ${peak}`;
      }
    } else {
      const dist = elite.size ? Math.min(3, Math.min(...[...elite].map((e) => Math.abs(e - year)))) : 0;
      const cap = peak - (age === null ? 0 : ageCurve(age)) - dist;
      if (rating > cap) {
        to = cap;
        why = `age ${age ?? "?"}${elite.size ? `, ${dist} yr${dist === 1 ? "" : "s"} from his best seasons` : ""}; peak ${peak}`;
      }
    }
    to = Math.max(80, Math.min(99, to));
    if (to !== rating) {
      out[p.id] = to;
      changes.push({ id: p.id, name: p.name, year, club: p.club, age, from: rating, to, why });
    }
  }
}

// This season's current cards: the 2026 awards (checked against the official announcements) set
// a floor. The Man of Steel is among the very best in the league, his shortlist close behind,
// and a Dream Team player is one of the top 13. Raises only.
const SEASON = 2026;
const MOS_SHORTLIST = new Set(["wigan-cur-adam-keighran", "leeds-cur-lachie-miller"]);
for (const { p, rating } of all) {
  if (p.category !== "current") continue;
  let floor = 0;
  let why = "";
  if ((MAN_OF_STEEL[p.id] ?? []).includes(SEASON)) [floor, why] = [93, `${SEASON} Man of Steel`];
  else if (MOS_SHORTLIST.has(p.id)) [floor, why] = [90, `${SEASON} Man of Steel shortlist`];
  else if ((p.dreamTeamYears ?? []).includes(SEASON)) [floor, why] = [88, `${SEASON} Dream Team`];
  if (rating < floor) {
    out[p.id] = floor;
    changes.push({ id: p.id, name: p.name, year: SEASON, club: p.club, age: p.birthYear ? SEASON - p.birthYear : null, from: rating, to: floor, why });
  }
}

changes.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from) || a.name.localeCompare(b.name));
const up = changes.filter((c) => c.to > c.from).length;
const down = changes.length - up;
console.log(`${all.length} cards, ${groups.size} players; ${changes.length} changes (${up} up, ${down} down)`);
for (const c of changes.slice(0, Number(process.env.SHOW ?? 40))) console.log(`${c.from} → ${c.to}  ${c.name} ${c.year} (${c.club}, age ${c.age ?? "?"}) — ${c.why}`);

if (process.argv.includes("--write")) {
  const ids = Object.keys(out).sort();
  const body = ids.map((id) => `  ${JSON.stringify(id)}: ${out[id]},`).join("\n");
  fs.writeFileSync(
    path.join(ROOT, "data", "player-rating-audit.ts"),
    `/**
 * Ratings audit, October 2026 (generated by scripts/audit-ratings.ts; see the report JSON).
 * Year cards follow each player's career: peak seasons (Dream Team, Man of Steel, Golden Boot)
 * near his best rating, teenage and late-career cards below it. Applied after the manual overrides.
 */
export const PLAYER_RATING_AUDIT: Record<string, number> = {
${body}
};
`
  );
  fs.writeFileSync(reportPath, JSON.stringify({ generated: "2026-10", up, down, changes }, null, 2) + "\n");
  console.log(`wrote ${ids.length} audited ratings`);
}
