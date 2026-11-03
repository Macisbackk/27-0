/**
 * 2026 current-card rescale (Nov 2026): every current card on a 70–99 scale.
 *
 * Before this, current cards sat on the same 80–99 scale as era cards, so a third of all 2026
 * squad players (academy kids, development forwards and fringe men alike) were tied at the 80
 * floor. Era (historic) and legend cards keep their 80 minimum; only category "current" changes.
 *
 * Inputs (all already in the repo):
 *   - the card's research rating before this rescale ("from": data/season-2026-ratings.json,
 *     PLAYER_RATING_AUDIT, overrides — whatever normalizePlayer produced on the old scale)
 *   - 2026 Super League Fantasy totals and prices (data/imports/fantasy-super-league-players-2026.md):
 *     points scale with minutes, starts, tries and work rate, price is the market's quality call
 *   - the 2026 two-season ratings sheet (data/imports/super_league_2026_ratings_cursor_import.json,
 *     from super_league_2026_ratings.xlsx): unfloored OVR (75+) and squad status
 *   - career appearances and age from the card
 *
 * Method:
 *   1. Above the old floor (from ≥ 81) the research rating already orders players, so it stays
 *      the backbone. An evidence model (least squares, fitted on those cards: fantasy points,
 *      price, sheet OVR) nudges each card by at most ±0.6 old points, so neighbours can swap
 *      only where the 2026 numbers say so. The result goes through the stretch curve STRETCH
 *      (old 82 → 82, 85 → 86, 88 → 89.5, 90 → 92, 93 → 95, 95 → 97).
 *   2. At the old floor (from ≤ 80) there was nothing to keep, so the 2026 evidence decides:
 *      FLOOR_TIERS by 2026 fantasy points (a proxy for minutes and starts), then career
 *      appearances for men with no 2026 minutes, with small bumps for the sheet's first-team
 *      status / OVR and a dip for academy teenagers. Capped at 80 so no floor man passes a
 *      researched 81+.
 *   3. Cards with no 2026 Super League evidence at all (no fantasy row, no sheet row, not a
 *      researched above-floor card) use the "no 2026 minutes" tiers — this includes a handful of
 *      "-hist-" ids tagged current (yearsActive "2026–Present") whose players are not in any
 *      2026 registered squad.
 *
 * Output: data/current-ratings-2026.json (id → { to, from, name, club, band, why }), applied by
 * normalizePlayer as the last word for category "current".
 * Run: bun scripts/build-current-ratings.ts   (then npm run build:runtime-player-data)
 */
import fs from "node:fs";
import { PLAYER_POOL, getAllDatabasePlayers } from "../src/lib/players";

const OUT = "data/current-ratings-2026.json";
type Row = { to: number; from: number; name: string; club: string; band: string; why: string };
const prev: Record<string, Row> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

// ---------------------------------------------------------------- name matching
const FIRST_ALIASES: Record<string, string> = {
  olly: "oliver", oli: "oliver", ollie: "oliver", matty: "matthew", matt: "matthew", mat: "matthew",
  tom: "thomas", tommy: "thomas", jon: "jonathan", jonny: "jonathan", johnny: "jonathan", joe: "joseph",
  joey: "joseph", sam: "samuel", sammy: "samuel", ben: "benjamin", benny: "benjamin", will: "william",
  billy: "william", alex: "alexander", dan: "daniel", danny: "daniel", josh: "joshua", jake: "jacob",
  mike: "michael", mikey: "michael", nick: "nicholas", chris: "christopher", ed: "edward",
  eddie: "edward", jim: "james", jimmy: "james", rob: "robert", robbie: "robert", bob: "robert",
  zac: "zach", zak: "zach", zachary: "zach", tony: "anthony", ant: "anthony",
};
const plain = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\bjr\b|\bjunior\b/g, "").replace(/[^a-z ]/g, "").trim();
const key = (s: string) => plain(s).replace(/ /g, "");
function aliasKey(s: string): string {
  const parts = plain(s).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join("");
  return [FIRST_ALIASES[parts[0]!] ?? parts[0], ...parts.slice(1)].join("");
}

// ---------------------------------------------------------------- 2026 fantasy table
type Fantasy = { name: string; price: number; score: number };
const POS_LABELS = ["Full Back", "Winger", "Centre", "Stand Off", "Scrum Half", "Prop", "Hooker", "Second Row", "Loose Forward"];
const fantasyByKey = new Map<string, Fantasy[]>();
const fantasyByAlias = new Map<string, Fantasy[]>();
for (const line of fs.readFileSync("data/imports/fantasy-super-league-players-2026.md", "utf8").split("\n")) {
  if (!line.startsWith("| |")) continue;
  const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  let name = cells[1]!;
  for (const label of POS_LABELS) if (name.endsWith(label)) name = name.slice(0, -label.length);
  const row: Fantasy = { name, price: Number(cells[3]!.replace(/k$/, "")), score: Number(cells[cells.length - 1]) };
  for (const [map, k] of [[fantasyByKey, key(name)], [fantasyByAlias, aliasKey(name)]] as const) {
    map.set(k, [...(map.get(k) ?? []), row]);
  }
}
function findFantasy(name: string): Fantasy | undefined {
  const exact = fantasyByKey.get(key(name));
  if (exact?.length === 1) return exact[0];
  if (exact && exact.length > 1) return undefined; // two players with one name — no guessing
  const alias = fantasyByAlias.get(aliasKey(name));
  return alias?.length === 1 ? alias[0] : undefined;
}

// ---------------------------------------------------------------- 2026 ratings sheet
type Sheet = { name: string; club: string; overall: number; sourceSquadStatus: string };
const sheetJson = JSON.parse(fs.readFileSync("data/imports/super_league_2026_ratings_cursor_import.json", "utf8")) as {
  players: Sheet[];
  excludedPlayers: Sheet[];
};
const sheetRows = [...sheetJson.players, ...sheetJson.excludedPlayers];
function findSheet(name: string, club: string): Sheet | undefined {
  for (const k of [key, aliasKey]) {
    const hits = sheetRows.filter((r) => k(r.name) === k(name));
    const atClub = hits.filter((r) => r.club === club);
    if (atClub.length === 1) return atClub[0];
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}
const FIRST_TEAM_STATUSES = new Set(["First Team", "First Team / Rotation", "First-Team Squad"]);
const ACADEMY_STATUSES = new Set(["Academy / Extended", "Development"]);

// ---------------------------------------------------------------- stretch curve (old → new)
/** Piecewise-linear map from the old 80–99 research scale to the new 70–99 current scale. */
export const STRETCH: [number, number][] = [
  [80.4, 79], [81, 80], [82, 82], [83, 83.4], [84, 84.8], [85, 86], [86, 87.2], [87, 88.4],
  [88, 89.6], [89, 90.8], [90, 92], [91, 93], [92, 94], [93, 95], [95, 97], [99, 99],
];
function stretch(x: number): number {
  if (x <= STRETCH[0]![0]) return STRETCH[0]![1];
  for (let i = 1; i < STRETCH.length; i++) {
    const [x1, y1] = STRETCH[i]!;
    const [x0, y0] = STRETCH[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 99;
}

// ---------------------------------------------------------------- floor tiers (new scale)
/** Old-floor cards: 2026 fantasy points first (minutes / starts), then career record. */
const FLOOR_TIERS = [
  { min: 300, base: 79, band: "rotation", label: "regular 2026 minutes" },
  { min: 120, base: 77.5, band: "rotation", label: "some 2026 games" },
  { min: 30, base: 75.5, band: "fringe", label: "a few 2026 appearances" },
  { min: 1, base: 74, band: "fringe", label: "a 2026 cameo" },
] as const;
function noMinutesTier(apps: number): { base: number; band: string; label: string } {
  if (apps >= 80) return { base: 74.5, band: "fringe", label: `no 2026 Super League minutes, ${apps} career apps` };
  if (apps >= 20) return { base: 73, band: "fringe", label: `no 2026 Super League minutes, ${apps} career apps` };
  return { base: 71.5, band: "academy", label: `no 2026 Super League minutes, ${apps} career apps` };
}

// ---------------------------------------------------------------- the cards
const cards = PLAYER_POOL.filter((p) => p.category === "current");
// The 485 cards include Championship cards hidden from Classic (availableInGame: false) — they
// are still current cards, so they get the same scale.
const allCurrent = new Map(cards.map((p) => [p.id, p]));
// Take the registry too, so a current card outside the gameplay pool still gets the scale.
for (const p of getAllDatabasePlayers()) if (p.category === "current" && !allCurrent.has(p.id)) allCurrent.set(p.id, p);

type Ev = {
  id: string;
  name: string;
  club: string;
  from: number;
  apps: number;
  age: number | undefined;
  fantasy?: Fantasy;
  sheet?: Sheet;
  hist: boolean;
};
const evidence: Ev[] = [...allCurrent.values()].map((p) => ({
  id: p.id,
  name: p.name,
  club: p.club,
  from: prev[p.id]?.from ?? p.peakRating,
  apps: p.appearances ?? 0,
  age: p.birthYear ? 2026 - p.birthYear : undefined,
  fantasy: findFantasy(p.name),
  sheet: findSheet(p.name, p.club),
  hist: p.id.includes("-hist-"),
}));

// Evidence model on the researched (≥ 82, uncensored) cards with full data.
const features = (e: Ev) => [1, Math.sqrt(Math.max(0, e.fantasy!.score)), e.fantasy!.price / 10, e.sheet!.overall];
const train = evidence.filter((e) => e.from >= 82 && e.fantasy && e.sheet);
function leastSquares(X: number[][], y: number[]): number[] {
  const n = X[0]!.length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) =>
    j < n ? X.reduce((s, r) => s + r[i]! * r[j]!, 0) : X.reduce((s, r, k) => s + r[i]! * y[k]!, 0)));
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[pivot]![c]!)) pivot = r;
    [A[c], A[pivot]] = [A[pivot]!, A[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r]![c]! / A[c]![c]!;
      for (let j = c; j <= n; j++) A[r]![j]! -= f * A[c]![j]!;
    }
  }
  return A.map((row, i) => row[n]! / row[i]!);
}
const beta = leastSquares(train.map(features), train.map((e) => e.from));
const predict = (e: Ev) => features(e).reduce((s, v, i) => s + v * beta[i]!, 0);
// The model regresses to the mean (top cards are always "predicted" lower), so a card is only
// nudged by how far its evidence sits from other cards with the same research rating.
const levelMean = new Map<number, number>();
for (const level of new Set(evidence.filter((e) => e.from >= 81).map((e) => e.from))) {
  const peers = evidence.filter((e) => e.from === level && e.fantasy && e.sheet);
  if (peers.length) levelMean.set(level, peers.reduce((s, e) => s + predict(e), 0) / peers.length);
}

const out: Record<string, Row> = {};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r1 = (x: number) => Math.round(x * 10) / 10;
for (const e of evidence.sort((a, b) => a.id.localeCompare(b.id))) {
  const facts: string[] = [];
  if (e.fantasy) facts.push(`2026 fantasy ${e.fantasy.score} pts, £${e.fantasy.price}k`);
  if (e.sheet) facts.push(`sheet ${e.sheet.overall} (${e.sheet.sourceSquadStatus})`);
  facts.push(`${e.apps} career apps${e.age ? `, age ${e.age}` : ""}`);
  let to: number;
  let band: string;
  let lead: string;
  const no2026 = !e.fantasy && !e.sheet;
  if (e.from >= 81 && !(e.hist && no2026)) {
    const peerMean = levelMean.get(e.from);
    const nudge = e.fantasy && e.sheet && peerMean !== undefined ? r1(clamp(0.4 * (predict(e) - peerMean), -0.6, 0.6)) : 0;
    to = Math.round(stretch(e.from + nudge));
    lead = `researched ${e.from}${nudge ? ` (2026 evidence ${nudge > 0 ? "+" : ""}${r1(nudge)})` : ""}`;
    band = to >= 92 ? "elite" : to >= 82 ? "first-team" : "rotation";
  } else {
    const score = e.fantasy?.score ?? 0;
    const tier = FLOOR_TIERS.find((t) => score >= t.min);
    const t = tier ?? noMinutesTier(e.apps);
    let x: number = t.base;
    if (e.hist && no2026) {
      // Career pedigree, but not in any 2026 registered squad.
      x += e.from >= 88 ? 1.5 : e.from >= 84 ? 1 : 0;
    }
    if (e.sheet && FIRST_TEAM_STATUSES.has(e.sheet.sourceSquadStatus)) x += 0.5;
    // The sheet's unfloored OVR (75 = its floor): up to +1 for a squad man it rated 77+.
    if (e.sheet) x += clamp((e.sheet.overall - 75) * 0.25, 0, 1);
    if (e.sheet && ACADEMY_STATUSES.has(e.sheet.sourceSquadStatus) && (e.age ?? 99) <= 20) x -= 0.5;
    // Teenagers with no senior record start at the bottom of the scale.
    if (!tier && (e.age ?? 99) <= 19 && e.apps <= 2) x -= 1;
    // Within a tier, the fantasy price separates proven men from the rest.
    if (e.fantasy && tier) x += clamp((e.fantasy.price - 80) / 40, -0.5, 0.5);
    to = clamp(Math.round(x), 70, 80);
    band = t.band;
    lead =
      e.hist && no2026
        ? `career card (was ${e.from}), not in a 2026 registered squad: ${t.label}`
        : `old floor ${e.from}: ${t.label}`;
  }
  to = clamp(to, 70, 99);
  out[e.id] = { to, from: e.from, name: e.name, club: e.club, band, why: `${lead}; ${facts.join("; ")}` };
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

const rows = Object.values(out);
const hist: Record<number, number> = {};
for (const r of rows) hist[r.to] = (hist[r.to] ?? 0) + 1;
console.log(`model: from ≈ ${beta.map((b) => b.toFixed(3)).join(" | ")} (1, √pts, price/10, sheet OVR) on ${train.length} cards`);
console.log(`${rows.length} current cards → ${OUT}`);
console.log(`matched: fantasy ${evidence.filter((e) => e.fantasy).length}, sheet ${evidence.filter((e) => e.sheet).length}`);
console.log(Object.entries(hist).map(([k, v]) => `${k}:${v}`).join(" "));
