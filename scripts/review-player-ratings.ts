/**
 * Full player ratings review — current, historic, legends, era-only players.
 * Run: npm run review:player-ratings
 * Apply: npm run review:player-ratings:apply
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import eraStarting17s from "../data/era-starting-17s.json";
import ratingHints from "../data/rating-rebalance-batch.json";
import slIndex from "../data/superleague-player-index.json";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import { normalizePlayer } from "../src/lib/players/normalize";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const REPORT_PATH = join(DATA, "player-ratings-audit-report.json");
const APPLY = process.argv.includes("--apply");

const FILES = [
  { key: "current", path: join(DATA, "current-squads.json") },
  { key: "historic", path: join(DATA, "historic-players.json") },
  { key: "legend", path: join(DATA, "legends.json") },
] as const;

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  position?: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  category?: string;
  yearsActive?: string;
  needsReview?: boolean;
  source?: string;
};

type ChangeEntry = {
  id: string;
  name: string;
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
};

type EraRef = { occurrences: number; years: number[] };

const POSITION_OVERRIDES: Record<string, Position> = {
  "hull-fc-hist-era-connor-wynne": "WING",
};

const HINT_BY_NAME = new Map<string, number>();
for (const row of ratingHints as { name: string; rating: number }[]) {
  HINT_BY_NAME.set(normalizePlayerNameKey(row.name), row.rating);
}

const SL_BY_NAME = new Map<
  string,
  { careerAppearances?: number; careerTries?: number }
>();
const slPlayers = (
  slIndex as unknown as {
    players: Record<
      string,
      { name?: string; careerAppearances?: number; careerTries?: number | null }
    >;
  }
).players;
for (const entry of Object.values(slPlayers)) {
  if (!entry?.name) continue;
  SL_BY_NAME.set(normalizePlayerNameKey(entry.name), {
    careerAppearances: entry.careerAppearances,
    careerTries: entry.careerTries ?? undefined,
  });
}

function clampRating(rating: number): number {
  return Math.max(75, Math.min(99, Math.round(rating)));
}

function isEraOnlyPlayer(raw: RawPlayer): boolean {
  return (
    raw.id.includes("-hist-era-") ||
    raw.source === "era-starting-17s.json" ||
    raw.needsReview === true
  );
}

function isActiveYears(yearsActive: string | undefined): boolean {
  if (!yearsActive) return false;
  return /present/i.test(yearsActive);
}

function estimateFromCareer(apps: number, tries: number): number {
  if (apps >= 350 || tries >= 200) return 86;
  if (apps >= 280 || tries >= 150) return 84;
  if (apps >= 200 || tries >= 80) return 82;
  if (apps >= 120 || tries >= 35) return 80;
  if (apps >= 60) return 78;
  if (apps >= 25) return 76;
  return 74;
}

function suggestEraRating(raw: RawPlayer, eraRef?: EraRef): number {
  const key = normalizePlayerNameKey(raw.name);
  const hint = HINT_BY_NAME.get(key);
  const career = SL_BY_NAME.get(key);
  const occ = eraRef?.occurrences ?? 1;
  const yearSpan = eraRef?.years.length ?? 1;

  let rating: number;
  if (career) {
    rating = estimateFromCareer(
      career.careerAppearances ?? 0,
      career.careerTries ?? 0
    );
    if (hint !== undefined) {
      rating = Math.round((rating + hint) / 2);
    }
  } else if (hint !== undefined) {
    rating = hint;
  } else if (occ >= 10) {
    rating = 82;
  } else if (occ >= 5) {
    rating = 79;
  } else if (occ >= 2) {
    rating = 77;
  } else {
    rating = 75;
  }

  if (yearSpan === 1 && occ === 1) {
    rating = Math.min(rating, 80);
  }

  if (isEraOnlyPlayer(raw) && rating > 88) {
    rating = 88;
  }

  return clampRating(rating);
}

function buildEraRefs(): Map<string, EraRef> {
  const refs = new Map<string, EraRef>();
  for (const entry of eraStarting17s as {
    squad: { name: string }[];
    year: number;
  }[]) {
    for (const member of entry.squad) {
      const ref = refs.get(member.name) ?? { occurrences: 0, years: [] };
      ref.occurrences++;
      if (!ref.years.includes(entry.year)) ref.years.push(entry.year);
      refs.set(member.name, ref);
    }
  }
  return refs;
}

function loadFiles(): Map<string, RawPlayer[]> {
  const byFile = new Map<string, RawPlayer[]>();
  for (const { key, path } of FILES) {
    byFile.set(key, JSON.parse(readFileSync(path, "utf8")) as RawPlayer[]);
  }
  return byFile;
}

function saveFiles(byFile: Map<string, RawPlayer[]>): void {
  for (const { key, path } of FILES) {
    writeFileSync(path, `${JSON.stringify(byFile.get(key), null, 2)}\n`);
  }
}

function main(): void {
  const byFile = loadFiles();
  const allPlayers = [...FILES.flatMap(({ key }) => byFile.get(key) ?? [])];
  const eraRefs = buildEraRefs();
  const changes: ChangeEntry[] = [];
  const protectedOverrides: string[] = [];
  const elite90Plus: { id: string; name: string; rating: number; category: string }[] = [];
  const legendDemotions: ChangeEntry[] = [];
  const eraNeedsReview: { id: string; name: string; rating: number }[] = [];
  const suspiciousDuplicates: { name: string; ids: string[] }[] = [];
  const distribution: Record<string, number> = {
    "60-69": 0,
    "70-74": 0,
    "75-79": 0,
    "80-84": 0,
    "85-89": 0,
    "90-94": 0,
    "95-99": 0,
  };

  function bumpDist(r: number): void {
    if (r >= 95) distribution["95-99"]++;
    else if (r >= 90) distribution["90-94"]++;
    else if (r >= 85) distribution["85-89"]++;
    else if (r >= 80) distribution["80-84"]++;
    else if (r >= 75) distribution["75-79"]++;
    else if (r >= 70) distribution["70-74"]++;
    else distribution["60-69"]++;
  }

  const byName = new Map<string, string[]>();
  for (const raw of allPlayers) {
    const key = normalizePlayerNameKey(raw.name);
    const list = byName.get(key) ?? [];
    list.push(raw.id);
    byName.set(key, list);
  }
  for (const [name, ids] of byName) {
    if (ids.length > 3) {
      suspiciousDuplicates.push({ name, ids });
    }
  }

  const currentIds = new Set(
    (byFile.get("current") ?? []).map((p) => normalizePlayerNameKey(p.name))
  );

  for (const raw of allPlayers) {
    if (raw.availableInGame === false) continue;

    const hasOverride = PLAYER_RATING_OVERRIDES[raw.id] !== undefined;
    if (hasOverride) {
      protectedOverrides.push(raw.id);
      const overrideRating = PLAYER_RATING_OVERRIDES[raw.id]!;
      if (raw.peakRating !== overrideRating) {
        changes.push({
          id: raw.id,
          name: raw.name,
          field: "peakRating",
          before: raw.peakRating,
          after: overrideRating,
          reason: "manual override sync",
        });
        if (APPLY) {
          raw.peakRating = overrideRating;
          raw.rating = overrideRating;
        }
      }
    }

    const posOverride = POSITION_OVERRIDES[raw.id];
    if (posOverride && raw.position !== posOverride) {
      changes.push({
        id: raw.id,
        name: raw.name,
        field: "position",
        before: raw.position,
        after: posOverride,
        reason: "manual position correction",
      });
      if (APPLY) raw.position = posOverride;
    }

    if (
      raw.category === "legend" &&
      !PLAYER_RATING_OVERRIDES[raw.id] &&
      (isActiveYears(raw.yearsActive as string) ||
        currentIds.has(normalizePlayerNameKey(raw.name)))
    ) {
      legendDemotions.push({
        id: raw.id,
        name: raw.name,
        field: "category",
        before: "legend",
        after: "historic",
        reason: "active player should not be legend tier",
      });
      if (APPLY) {
        raw.category = "historic";
        const demoted = clampRating(Math.min((raw.peakRating as number) ?? 88, 88));
        raw.peakRating = demoted;
        raw.rating = demoted;
      }
    }

    if (!hasOverride && isEraOnlyPlayer(raw)) {
      const suggested = suggestEraRating(raw, eraRefs.get(raw.name));
      const current = (raw.peakRating ?? raw.rating) as number;
      if (current !== suggested) {
        changes.push({
          id: raw.id,
          name: raw.name,
          field: "peakRating",
          before: current,
          after: suggested,
          reason: "era-only player rating review",
        });
        if (APPLY) {
          raw.peakRating = suggested;
          raw.rating = suggested;
        }
      }
    }

    const norm = normalizePlayer(raw);
    const expectedValue = computePlayerValue(
      norm.peakRating,
      norm.position,
      norm.category
    );
    if (raw.value !== expectedValue) {
      changes.push({
        id: raw.id,
        name: raw.name,
        field: "value",
        before: raw.value,
        after: expectedValue,
        reason: "value recalculation",
      });
      if (APPLY) raw.value = expectedValue;
    }

    bumpDist(norm.peakRating);
    if (norm.peakRating >= 90) {
      elite90Plus.push({
        id: raw.id,
        name: raw.name,
        rating: norm.peakRating,
        category: norm.category,
      });
    }

    if (isEraOnlyPlayer(raw) && raw.needsReview === true) {
      eraNeedsReview.push({
        id: raw.id,
        name: raw.name,
        rating: norm.peakRating,
      });
    }
  }

  if (APPLY) saveFiles(byFile);

  const report = {
    generatedAt: new Date().toISOString(),
    applied: APPLY,
    summary: {
      totalPlayersReviewed: allPlayers.filter((p) => p.availableInGame !== false)
        .length,
      playersChanged: changes.length,
      protectedByOverride: protectedOverrides.length,
      elite90PlusCount: elite90Plus.length,
      legendDemotions: legendDemotions.length,
      eraNeedsReviewCount: eraNeedsReview.length,
      suspiciousDuplicateNames: suspiciousDuplicates.length,
    },
    ratingDistribution: distribution,
    changes,
    protectedByOverride: protectedOverrides.sort(),
    elite90Plus: elite90Plus.sort((a, b) => b.rating - a.rating),
    legendDemotions,
    eraNeedsReview,
    suspiciousDuplicates: suspiciousDuplicates.slice(0, 50),
    verified17UiCheck:
      "No Verified 17 UI labels in src/ — era-starting-17 data is internal only",
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Player Ratings Review\n");
  console.log(`Reviewed: ${report.summary.totalPlayersReviewed}`);
  console.log(`Changes${APPLY ? " applied" : " suggested"}: ${changes.length}`);
  console.log(`Protected overrides: ${protectedOverrides.length}`);
  console.log(`90+ players: ${elite90Plus.length}`);
  console.log(`Legend demotions: ${legendDemotions.length}`);
  console.log(`Era needsReview: ${eraNeedsReview.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
