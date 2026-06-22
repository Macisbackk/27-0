/**
 * Legend tier audit — demote misclassified legends, promote genuine SL greats,
 * sync achievements/stats/ratings, rebuild honour sidecars.
 *
 * Run: npx tsx scripts/audit-legend-tier.ts [--apply]
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import { normalizePlayer } from "../src/lib/players/normalize";
import { computePlayerValue } from "../src/lib/players/ratings";
import {
  getDreamTeamYears,
  getGoldenBootYears,
  getManOfSteelYears,
} from "../src/lib/players/achievements";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const APPLY = process.argv.includes("--apply");

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  category?: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  club?: string;
  nationality?: string;
  position?: string;
  manOfSteel?: boolean;
  hallOfFame?: boolean;
};

/** Permanent elite — Hall of Fame / all-time SL icons. */
const KEEP_LEGEND_IDS = new Set([
  "andrew-johns",
  "jason-robinson",
  "garry-schofield",
  "ellery-hanley",
  "kevin-sinfield",
  "wigan-hist-sam-tomkins",
  "andy-farrell",
  "paul-sculthorpe",
  "bradford-leg-robbie-hunter-paul",
  "sam-burgess",
  "martin-offiah",
  "rob-burrow",
  "jamie-peacock",
  "paul-newlove",
]);

/** Promote from historic — verified SL legends missing from tier. */
const PROMOTE_TO_LEGEND: Array<{
  id: string;
  rating: number;
  reason: string;
}> = [
  {
    id: "sean-long",
    rating: 91,
    reason: "Man of Steel 2000, Dream Team, St Helens dynasty halfback",
  },
  {
    id: "danny-mcguire",
    rating: 91,
    reason: "Leeds Rhinos icon, 271 tries, multiple SL/CC titles, Dream Team",
  },
  {
    id: "adrian-morley",
    rating: 90,
    reason: "4× Dream Team, SL/CC winner, 26 caps, long elite enforcer career",
  },
  {
    id: "stuart-fielden",
    rating: 90,
    reason: "3× Dream Team, Wigan/Bradford prop great, SL titles",
  },
];

/** Demote with ID rename (legend → historic). */
const DEMOTE_RENAME: Array<{
  legendId: string;
  historicId: string;
  name: string;
  rating: number;
  nationality?: string;
  reason: string;
}> = [
  { legendId: "huddersfield-leg-aaron-murphy", historicId: "huddersfield-hist-aaron-murphy", name: "Aaron Murphy", rating: 84, reason: "Solid winger, not SL all-time great" },
  { legendId: "wakefield-leg-ben-jeffries", historicId: "wakefield-hist-ben-jeffries", name: "Ben Jeffries", rating: 84, reason: "Good halfback, no major individual honours" },
  { legendId: "castleford-leg-brett-ferres", historicId: "castleford-hist-brett-ferres", name: "Brett Ferres", rating: 88, reason: "Strong forward, not legend tier" },
  { legendId: "leeds-leg-chev-walker", historicId: "leeds-hist-chev-walker", name: "Chev Walker", rating: 87, nationality: "England", reason: "Leeds stalwart, not generational great" },
  { legendId: "leeds-leg-francis-cummins", historicId: "leeds-hist-francis-cummins", name: "Francis Cummins", rating: 89, reason: "Good winger, below legend bar" },
  { legendId: "wigan-leg-gary-connolly", historicId: "wigan-hist-garry-connolly", name: "Garry Connolly", rating: 89, nationality: "England", reason: "Strong centre, not SL icon" },
  { legendId: "huddersfield-leg-jermaine-mcgillvary", historicId: "huddersfield-hist-jermaine-mcgillvary", name: "Jermaine McGillvary", rating: 90, reason: "Elite winger but not legend tier" },
  { legendId: "wigan-leg-joel-tomkins", historicId: "wigan-hist-joel-tomkins", name: "Joel Tomkins", rating: 88, nationality: "England", reason: "Good forward, not all-time great" },
  { legendId: "hull-fc-leg-lee-radford", historicId: "hull-fc-hist-lee-radford", name: "Lee Radford", rating: 90, nationality: "England", reason: "Club hero, not SL legend" },
  { legendId: "huddersfield-leg-leroy-cudjoe", historicId: "huddersfield-hist-leroy-cudjoe", name: "Leroy Cudjoe", rating: 87, nationality: "England", reason: "One-club stalwart, not legend calibre" },
  { legendId: "leeds-leg-matt-diskin", historicId: "leeds-hist-matt-diskin", name: "Matt Diskin", rating: 88, reason: "Leeds hooker, below legend tier" },
  { legendId: "london-leg-paul-sykes", historicId: "wakefield-hist-paul-sykes", name: "Paul Sykes", rating: 87, nationality: "England", reason: "Solid kicker/centre, not legend" },
  { legendId: "wigan-leg-paul-johnson", historicId: "wigan-hist-paul-johnson", name: "Paul Johnson", rating: 86, reason: "Good centre, not SL icon" },
];

/** Demote by removing legend duplicate — historic record already exists. */
const DEMOTE_REMOVE_ONLY: Array<{
  legendId: string;
  keepHistoricId: string;
  reason: string;
}> = [
  { legendId: "leeds-leg-mark-calderwood", keepHistoricId: "leeds-hist-mark-calderwood", reason: "RLP misclassification at 97 — solid winger only" },
  { legendId: "leeds-leg-richard-mathers", keepHistoricId: "leeds-hist-richard-mathers", reason: "Duplicate of Richie Mathers historic card" },
  { legendId: "wigan-leg-terry-newton", keepHistoricId: "wigan-hist-terry-newton", reason: "Good hooker, not legend tier" },
  { legendId: "wakefield-leg-stefan-ratchford", keepHistoricId: "wakefield-leg-stefan-ratchford", reason: "Strong fullback but not SL all-time great" },
  { legendId: "hull-fc-leg-danny-tickle", keepHistoricId: "hull-fc-hist-danny-tickle", reason: "Long career, not legend calibre" },
  { legendId: "castleford-leg-jon-wells", keepHistoricId: "castleford-hist-jon-wells", reason: "Solid winger, not legend tier" },
];

const POSITION_MAP: Record<string, string> = {
  CENTRE: "Centre",
  WING: "Wing",
  HOOKER: "Hooker",
  SECOND_ROW: "Second row",
  SCRUM_HALF: "Scrum-half",
  FULLBACK: "Fullback",
  PROP: "Prop",
  LOOSE_FORWARD: "Loose forward",
  STAND_OFF: "Stand-off",
};

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function saveJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function honourScore(playerId: string, raw: RawPlayer): number {
  let score = 0;
  const mos = getManOfSteelYears(playerId).length;
  const dt = getDreamTeamYears(playerId).length;
  const gb = getGoldenBootYears(playerId).length;
  if (mos > 0) score += 3 * mos;
  score += Math.min(dt, 4);
  if (gb > 0) score += 3;
  if (raw.superLeagueWinner) score += 2;
  if (raw.challengeCupWinner) score += 1;
  if ((raw.intlCaps as number) >= 20) score += 2;
  else if ((raw.intlCaps as number) >= 10) score += 1;
  if (raw.hallOfFame) score += 3;
  if ((raw.appearances as number) >= 400) score += 1;
  return score;
}

function syncAchievementFlags(raw: RawPlayer): string[] {
  const fixes: string[] = [];
  const id = raw.id;
  const mos = getManOfSteelYears(id).length > 0;
  if (raw.manOfSteel !== mos) {
    fixes.push(`manOfSteel ${raw.manOfSteel} → ${mos}`);
    raw.manOfSteel = mos;
  }
  return fixes;
}

function applyRating(raw: RawPlayer, rating: number): void {
  raw.peakRating = rating;
  raw.rating = rating;
  const norm = normalizePlayer(raw);
  raw.value = computePlayerValue(norm.peakRating, norm.position, norm.category);
}

function migrateEraSquads(
  idMap: Map<string, string>
): number {
  if (idMap.size === 0) return 0;
  const squads = loadJson<Record<string, Record<string, { playerIds: string[] }>>>(
    join(DATA, "era-wikipedia-squads.json")
  );
  let swaps = 0;
  for (const years of Object.values(squads)) {
    for (const entry of Object.values(years)) {
      if (!entry?.playerIds) continue;
      for (let i = 0; i < entry.playerIds.length; i++) {
        const oldId = entry.playerIds[i]!;
        const newId = idMap.get(oldId);
        if (newId) {
          entry.playerIds[i] = newId;
          swaps++;
        }
      }
    }
  }
  if (swaps > 0 && APPLY) {
    saveJson(join(DATA, "era-wikipedia-squads.json"), squads);
  }
  return swaps;
}

function dedupeDreamTeamYears(): number {
  const dt = loadJson<Record<string, number[]>>(join(DATA, "dream-team-years.json"));
  let fixed = 0;
  for (const [id, years] of Object.entries(dt)) {
    const unique = [...new Set(years)].sort((a, b) => a - b);
    if (unique.length !== years.length) {
      dt[id] = unique;
      fixed++;
    }
  }
  if (fixed > 0 && APPLY) {
    saveJson(join(DATA, "dream-team-years.json"), dt);
  }
  return fixed;
}

function toHistoricFromLegend(
  source: RawPlayer,
  historicId: string,
  name: string,
  rating: number,
  nationality?: string
): RawPlayer {
  const pos = source.position as string;
  return {
    ...source,
    id: historicId,
    name,
    position: POSITION_MAP[pos] ?? pos,
    nationality: nationality ?? (source.nationality as string) ?? "England",
    category: "historic",
    peakRating: rating,
    rating,
    clubLegend: true,
    hallOfFame: false,
  };
}

function main(): void {
  const legends = loadJson<RawPlayer[]>(join(DATA, "legends.json"));
  const historic = loadJson<RawPlayer[]>(join(DATA, "historic-players.json"));
  const historicById = new Map(historic.map((p) => [p.id, p]));
  const legendById = new Map(legends.map((p) => [p.id, p]));

  const retained: Array<{ id: string; name: string; reason: string }> = [];
  const downgraded: Array<{ id: string; name: string; toId: string; reason: string }> = [];
  const promoted: Array<{ id: string; name: string; reason: string }> = [];
  const ratingsChanged: Array<{ id: string; name: string; before: number; after: number }> = [];
  const achievementFixes: Array<{ id: string; fixes: string[] }> = [];
  const statFixes: string[] = [];
  const recommendedLegend: Array<{ id: string; name: string; score: number; reason: string }> = [];

  const idMap = new Map<string, string>();
  const demoteRenameIds = new Set(DEMOTE_RENAME.map((d) => d.legendId));
  const demoteRemoveIds = new Set(DEMOTE_REMOVE_ONLY.map((d) => d.legendId));
  const promoteIds = new Set(PROMOTE_TO_LEGEND.map((p) => p.id));

  // ── Report: honour scores for all current + historic 90+ ────────────────
  for (const raw of [...legends, ...historic]) {
    if (raw.category !== "legend" && (raw.peakRating ?? 0) < 90) continue;
    if (raw.category === "legend") continue;
    if (KEEP_LEGEND_IDS.has(raw.id) || promoteIds.has(raw.id)) continue;
    const score = honourScore(raw.id, raw);
    if (score >= 7 && !promoteIds.has(raw.id)) {
      recommendedLegend.push({
        id: raw.id,
        name: raw.name,
        score,
        reason: `Honour score ${score} — review for legend promotion`,
      });
    }
  }

  const newLegends: RawPlayer[] = [];

  // ── Process existing legends ────────────────────────────────────────────
  for (const legend of legends) {
    const id = legend.id;

    if (KEEP_LEGEND_IDS.has(id)) {
      const fixes = syncAchievementFlags(legend);
      if (legend.nationality === "Unknown") {
        statFixes.push(`${legend.name}: nationality Unknown`);
      }
      const override = PLAYER_RATING_OVERRIDES[id];
      if (override !== undefined) {
        const before = legend.peakRating as number;
        if (before !== override) {
          ratingsChanged.push({ id, name: legend.name, before, after: override });
          if (APPLY) applyRating(legend, override);
        }
      }
      if (APPLY) {
        const norm = normalizePlayer(legend);
        legend.value = computePlayerValue(norm.peakRating, norm.position, "legend");
      }
      if (fixes.length) achievementFixes.push({ id, fixes });
      newLegends.push(legend);
      retained.push({ id, name: legend.name, reason: "Elite SL icon — permanent legend" });
      continue;
    }

    const rename = DEMOTE_RENAME.find((d) => d.legendId === id);
    if (rename) {
      downgraded.push({
        id,
        name: legend.name,
        toId: rename.historicId,
        reason: rename.reason,
      });
      idMap.set(id, rename.historicId);
      if (APPLY) {
        const record = toHistoricFromLegend(
          legend,
          rename.historicId,
          rename.name,
          rename.rating,
          rename.nationality
        );
        applyRating(record, rename.rating);
        historicById.set(rename.historicId, record);
        // Remove stale name duplicates
        for (const [hid, h] of [...historicById]) {
          if (
            hid !== rename.historicId &&
            h.name.toLowerCase() === rename.name.toLowerCase()
          ) {
            historicById.delete(hid);
          }
        }
      }
      continue;
    }

    const removeOnly = DEMOTE_REMOVE_ONLY.find((d) => d.legendId === id);
    if (removeOnly) {
      downgraded.push({
        id,
        name: legend.name,
        toId: removeOnly.keepHistoricId,
        reason: removeOnly.reason,
      });
      if (APPLY) {
        const keep = historicById.get(removeOnly.keepHistoricId);
        if (keep) {
          const override = PLAYER_RATING_OVERRIDES[removeOnly.keepHistoricId];
          if (override) applyRating(keep, override);
        }
      }
      continue;
    }

    // Fallback: demote unknown legend entries in-place
    downgraded.push({
      id,
      name: legend.name,
      toId: id.replace(/-leg-/, "-hist-"),
      reason: "Unlisted legend — demoted to historic",
    });
    if (APPLY) {
      const historicId = id.replace(/-leg-/, "-hist-");
      idMap.set(id, historicId);
      const record = toHistoricFromLegend(legend, historicId, legend.name, 88);
      applyRating(record, 88);
      historicById.set(historicId, record);
    }
  }

  // ── Promote historic → legend ─────────────────────────────────────────
  for (const promo of PROMOTE_TO_LEGEND) {
    const raw = historicById.get(promo.id);
    if (!raw) {
      console.warn(`Promote target not found: ${promo.id}`);
      continue;
    }
    promoted.push({ id: promo.id, name: raw.name, reason: promo.reason });
    const before = (raw.peakRating ?? raw.rating) as number;
    if (before !== promo.rating) {
      ratingsChanged.push({
        id: promo.id,
        name: raw.name,
        before,
        after: promo.rating,
      });
    }
    if (APPLY) {
      const legendCard: RawPlayer = {
        ...raw,
        category: "legend",
        clubLegend: true,
        hallOfFame: raw.hallOfFame ?? false,
      };
      applyRating(legendCard, promo.rating);
      syncAchievementFlags(legendCard);
      newLegends.push(legendCard);
      historicById.delete(promo.id);
    } else {
      retained.push({ id: promo.id, name: raw.name, reason: promo.reason });
    }
  }

  const eraIdSwaps = migrateEraSquads(idMap);
  const dreamTeamDeduped = dedupeDreamTeamYears();

  if (APPLY) {
    saveJson(join(DATA, "legends.json"), newLegends);
    saveJson(join(DATA, "historic-players.json"), [...historicById.values()]);

    // Clean player-additions legend staging
    const additionsPath = join(DATA, "player-additions.json");
    const additions = loadJson<{
      legend?: RawPlayer[];
      historic?: RawPlayer[];
    }>(additionsPath);
    if (additions.legend) {
      const removeIds = new Set([
        ...demoteRenameIds,
        ...demoteRemoveIds,
      ]);
      additions.legend = additions.legend.filter((p) => !removeIds.has(p.id));
    }
    saveJson(additionsPath, additions);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "report-only",
    summary: {
      legendsBefore: legends.length,
      legendsAfter: APPLY ? newLegends.length : legends.length - downgraded.length + promoted.length,
      retained: retained.length,
      downgraded: downgraded.length,
      promoted: promoted.length,
      ratingsChanged: ratingsChanged.length,
      achievementFixes: achievementFixes.length,
      eraIdSwaps,
      dreamTeamDeduped,
    },
    legendPlayersRetained: retained,
    legendPlayersDowngraded: downgraded,
    historicPlayersPromoted: promoted,
    historicRecommendedForLegend: recommendedLegend.sort((a, b) => b.score - a.score),
    ratingsChanged,
    achievementCorrections: achievementFixes,
    statCorrections: statFixes,
    specialAttention: {
      rated90Plus: [...legends, ...historic]
        .filter((p) => (p.peakRating ?? 0) >= 90)
        .map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          rating: p.peakRating,
          honourScore: honourScore(p.id, p),
        }))
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
      multiYearCards: [...historic]
        .filter((p) => /-\d{4}$/.test(p.id))
        .map((p) => p.id),
    },
  };

  saveJson(join(DATA, "legend-tier-audit-report.json"), report);

  console.log("Legend tier audit\n");
  console.log(`Mode: ${APPLY ? "APPLY" : "REPORT ONLY"}`);
  console.log(`Legends before: ${legends.length}`);
  console.log(`Retained: ${retained.length}`);
  console.log(`Downgraded: ${downgraded.length}`);
  console.log(`Promoted: ${promoted.length}`);
  console.log(`Ratings changed: ${ratingsChanged.length}`);
  console.log(`Era squad ID swaps: ${eraIdSwaps}`);
  console.log(`Dream Team deduped entries: ${dreamTeamDeduped}`);
  console.log(`Report: data/legend-tier-audit-report.json`);

  if (!APPLY) {
    console.log("\nRe-run with --apply to write changes.");
  }
}

main();
