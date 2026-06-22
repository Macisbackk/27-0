/**
 * Full player rating + year-card accuracy audit.
 * Run: npx tsx scripts/audit-player-ratings-and-year-cards.ts [--apply]
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import clubCareerSpans from "../data/club-career-spans.json";
import { getAllEraTeams, buildEraSquadFromRoster, isPlayerActiveInYear } from "../src/lib/players/era-teams";
import { getEraWikipediaSquads } from "../src/lib/players/era-wikipedia-squads";
import { normalizePlayer } from "../src/lib/players/normalize";
import { parsePlayerId } from "../src/lib/players/prime-year";
import { computePlayerValue } from "../src/lib/players/ratings";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import { getSquadValue } from "../src/lib/positions";
import { getPlayerById } from "../src/lib/players";
import type { Position } from "../src/lib/types";
import { YEAR_CARD_OVERRIDES } from "./lib/year-card-overrides";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const APPLY = process.argv.includes("--apply");

const FILES = [
  { key: "current", path: join(DATA, "current-squads.json") },
  { key: "historic", path: join(DATA, "historic-players.json") },
  { key: "legend", path: join(DATA, "legends.json") },
] as const;

type RawPlayer = Record<string, unknown> & {
  id: string;
  name?: string;
  club?: string;
  position?: string;
  peakRating?: number;
  rating?: number;
  value?: number;
  category?: string;
  yearsActive?: string;
  cardYear?: number;
  clubsPlayedFor?: string[];
};

const RLP_CLUB_ALIASES: Record<string, string> = {
  "Hull KR": "Hull KR",
  Leigh: "Leigh Leopards",
  "Leigh Centurions": "Leigh Leopards",
  Salford: "Salford Red Devils",
  York: "York Knights",
  Huddersfield: "Huddersfield Giants",
  Wakefield: "Wakefield Trinity",
  Wigan: "Wigan Warriors",
  Warrington: "Warrington Wolves",
  Leeds: "Leeds Rhinos",
  Bradford: "Bradford Bulls",
  Castleford: "Castleford Tigers",
  Catalans: "Catalans Dragons",
  London: "London Broncos",
  "St Helens": "St Helens",
  "Hull FC": "Hull FC",
};

const EXTRA_CLUB_SPANS = clubCareerSpans as Record<string, string[]>;

interface AuditEntry {
  playerId: string;
  name: string;
  kind: string;
  message: string;
  before?: unknown;
  after?: unknown;
}

function loadAllRaw(): {
  byFile: Map<string, RawPlayer[]>;
  byId: Map<string, { raw: RawPlayer; fileKey: string }>;
} {
  const byFile = new Map<string, RawPlayer[]>();
  const byId = new Map<string, { raw: RawPlayer; fileKey: string }>();

  for (const { key, path } of FILES) {
    const players = JSON.parse(readFileSync(path, "utf8")) as RawPlayer[];
    byFile.set(key, players);
    for (const raw of players) {
      byId.set(raw.id, { raw, fileKey: key });
    }
  }
  return { byFile, byId };
}

function parseYearFromId(id: string): number | undefined {
  const m = id.match(/-(\d{4})$/);
  return m ? Number(m[1]) : undefined;
}

function playerPlayedForClubInYear(
  raw: RawPlayer,
  club: string,
  year: number
): boolean {
  const primary = raw.club as string;
  if (primary === club) return true;

  for (const label of raw.clubsPlayedFor ?? []) {
    const mapped = RLP_CLUB_ALIASES[label] ?? label;
    if (mapped === club) return true;
  }

  for (const c of EXTRA_CLUB_SPANS[raw.id] ?? []) {
    if (c === club) return true;
  }

  const override = YEAR_CARD_OVERRIDES[raw.id];
  if (override?.club === club) return true;

  return false;
}

function main(): void {
  const { byFile, byId } = loadAllRaw();
  const allRaw = [...byId.values()].map((e) => e.raw);

  const ratingsChanged: AuditEntry[] = [];
  const valuesRecalculated: AuditEntry[] = [];
  const yearCardsFixed: AuditEntry[] = [];
  const flaggedNotChanged: AuditEntry[] = [];
  const clubYearMismatches: AuditEntry[] = [];
  const positionMismatches: AuditEntry[] = [];
  const duplicateYearCards: AuditEntry[] = [];
  const overrideConflicts: AuditEntry[] = [];
  const elite90Plus: AuditEntry[] = [];
  const identicalYearRatings: AuditEntry[] = [];

  const ratingDistribution = {
    "75-79": 0,
    "80-84": 0,
    "85-89": 0,
    "90-94": 0,
    "95-99": 0,
  };

  function bumpDistribution(rating: number): void {
    if (rating >= 95) ratingDistribution["95-99"]++;
    else if (rating >= 90) ratingDistribution["90-94"]++;
    else if (rating >= 85) ratingDistribution["85-89"]++;
    else if (rating >= 80) ratingDistribution["80-84"]++;
    else ratingDistribution["75-79"]++;
  }

  // ── Per-player audit + safe fixes ─────────────────────────────────────
  for (const raw of allRaw) {
    if (raw.availableInGame === false) continue;

    const normalized = normalizePlayer(raw);
    const hasOverride = PLAYER_RATING_OVERRIDES[raw.id] !== undefined;
    const expectedValue = computePlayerValue(
      normalized.peakRating,
      normalized.position,
      normalized.category
    );
    const rawRating = (raw.peakRating ?? raw.rating) as number | undefined;
    const rawValue = raw.value as number | undefined;

    bumpDistribution(normalized.peakRating);

    if (normalized.peakRating >= 90) {
      elite90Plus.push({
        playerId: raw.id,
        name: normalized.name,
        kind: "elite_90_plus",
        message: `${normalized.category} @ ${normalized.peakRating}${hasOverride ? " [override]" : ""}`,
      });
    }

    // Year-card override alignment (safe fix)
    const ycOverride = YEAR_CARD_OVERRIDES[raw.id];
    if (ycOverride && !hasOverride) {
      const year = parseYearFromId(raw.id);
      if (ycOverride.rating !== undefined && rawRating !== ycOverride.rating) {
        const entry: AuditEntry = {
          playerId: raw.id,
          name: normalized.name,
          kind: "year_card_rating",
          message: `Year card rating ${rawRating} → ${ycOverride.rating}`,
          before: rawRating,
          after: ycOverride.rating,
        };
        if (APPLY) {
          raw.peakRating = ycOverride.rating;
          raw.rating = ycOverride.rating;
          yearCardsFixed.push(entry);
        } else {
          flaggedNotChanged.push(entry);
        }
      }
      if (raw.club !== ycOverride.club) {
        clubYearMismatches.push({
          playerId: raw.id,
          name: normalized.name,
          kind: "year_card_club",
          message: `Club ${raw.club} ≠ expected ${ycOverride.club}`,
          before: raw.club,
          after: ycOverride.club,
        });
        if (APPLY) {
          raw.club = ycOverride.club;
          yearCardsFixed.push({
            playerId: raw.id,
            name: normalized.name,
            kind: "year_card_club_fix",
            message: `Club set to ${ycOverride.club}`,
          });
        }
      }
      if (raw.position !== ycOverride.position) {
        positionMismatches.push({
          playerId: raw.id,
          name: normalized.name,
          kind: "year_card_position",
          message: `Position ${raw.position} ≠ expected ${ycOverride.position}`,
          before: raw.position,
          after: ycOverride.position,
        });
        if (APPLY) {
          raw.position = ycOverride.position;
          yearCardsFixed.push({
            playerId: raw.id,
            name: normalized.name,
            kind: "year_card_position_fix",
            message: `Position set to ${ycOverride.position}`,
          });
        }
      }
      if (year !== undefined) {
        const expectedSpan = `${year}–${year}`;
        if (raw.yearsActive !== expectedSpan) {
          if (APPLY) {
            raw.yearsActive = expectedSpan;
            raw.cardYear = year;
          }
        }
      }
    }

    // Sync JSON to manual override (authoritative)
    if (hasOverride) {
      const overrideRating = PLAYER_RATING_OVERRIDES[raw.id]!;
      if (rawRating !== overrideRating) {
        const entry: AuditEntry = {
          playerId: raw.id,
          name: normalized.name,
          kind: "override_json_sync",
          message: `JSON rating ${rawRating} synced to override ${overrideRating}`,
          before: rawRating,
          after: overrideRating,
        };
        if (APPLY) {
          raw.peakRating = overrideRating;
          raw.rating = overrideRating;
          ratingsChanged.push(entry);
        } else {
          flaggedNotChanged.push(entry);
        }
      }
    }

    // Value recalculation
    const postNorm = normalizePlayer(raw);
    const newExpected = computePlayerValue(
      postNorm.peakRating,
      postNorm.position,
      postNorm.category
    );
    if (rawValue !== newExpected) {
      const entry: AuditEntry = {
        playerId: raw.id,
        name: postNorm.name,
        kind: "value_recalc",
        message: `Value ${rawValue} → ${newExpected}`,
        before: rawValue,
        after: newExpected,
      };
      if (APPLY) {
        raw.value = newExpected;
        valuesRecalculated.push(entry);
      } else {
        flaggedNotChanged.push(entry);
      }
    }

    // Flag: year card copied base rating when multi-year exists
    const parsed = parsePlayerId(raw.id);
    if (parsed.yearCardYear !== undefined && ycOverride?.rating === undefined) {
      const base = byId.get(parsed.baseId)?.raw;
      if (base) {
        const baseNorm = normalizePlayer(base);
        if (
          postNorm.peakRating === baseNorm.peakRating &&
          !hasOverride
        ) {
          identicalYearRatings.push({
            playerId: raw.id,
            name: postNorm.name,
            kind: "copied_base_rating",
            message: `Year ${parsed.yearCardYear} card rating ${postNorm.peakRating} matches base — review for year-specific adjustment`,
          });
        }
      }
    }

    // Suggest override conflict (audit only — never auto-change overrides)
    if (
      !hasOverride &&
      rawRating !== undefined &&
      rawRating >= 92 &&
      normalized.category !== "legend"
    ) {
      overrideConflicts.push({
        playerId: raw.id,
        name: normalized.name,
        kind: "high_rating_no_override",
        message: `Non-legend rated ${rawRating} — verify elite status`,
      });
    }
  }

  // ── Duplicate year-card groups ────────────────────────────────────────
  const byBaseId = new Map<string, RawPlayer[]>();
  for (const raw of allRaw) {
    const { baseId, yearCardYear } = parsePlayerId(raw.id);
    if (yearCardYear === undefined) continue;
    const list = byBaseId.get(baseId) ?? [];
    list.push(raw);
    byBaseId.set(baseId, list);
  }
  for (const [baseId, cards] of byBaseId) {
    if (cards.length < 2) continue;
    const ratings = cards.map(
      (c) => normalizePlayer(c).peakRating
    );
    const uniqueRatings = new Set(ratings);
    duplicateYearCards.push({
      playerId: baseId,
      name: cards[0].name ?? baseId,
      kind: "multi_year_cards",
      message: `${cards.length} year cards: ${cards.map((c) => c.id).join(", ")}`,
    });
    if (uniqueRatings.size === 1) {
      identicalYearRatings.push({
        playerId: baseId,
        name: cards[0].name ?? baseId,
        kind: "identical_multi_year_ratings",
        message: `All ${cards.length} year cards share rating ${ratings[0]}`,
      });
    }
  }

  // ── Era squad club/year + position validation ─────────────────────────
  const squads = getEraWikipediaSquads();
  const teamsAffected = new Set<string>();

  for (const [club, years] of Object.entries(squads)) {
    for (const [year, entry] of Object.entries(years)) {
      const yearNum = Number(year);
      if (!entry?.playerIds?.length) continue;

      for (let i = 0; i < entry.playerIds.length; i++) {
        const playerId = entry.playerIds[i]!;
        const slotPos = entry.positions?.[i] as Position | undefined;
        const record = byId.get(playerId);
        const player = getPlayerById(playerId);

        if (!record) {
          clubYearMismatches.push({
            playerId,
            name: playerId,
            kind: "missing_player",
            message: `In ${club} ${year} squad but not in database`,
          });
          teamsAffected.add(`${club} ${year}`);
          continue;
        }

        const raw = record.raw;
        const norm = player ?? normalizePlayer(raw);

        if (!isPlayerActiveInYear(norm, yearNum)) {
          clubYearMismatches.push({
            playerId,
            name: norm.name,
            kind: "inactive_in_year",
            message: `${norm.yearsActive} does not cover ${year} (${club} squad)`,
          });
          teamsAffected.add(`${club} ${year}`);
        }

        const yc = YEAR_CARD_OVERRIDES[playerId];
        const expectedClub = yc?.club ?? (raw.club as string);
        if (expectedClub !== club && !playerPlayedForClubInYear(raw, club, yearNum)) {
          clubYearMismatches.push({
            playerId,
            name: norm.name,
            kind: "club_year_mismatch",
            message: `In ${club} ${year} squad but primary club is ${expectedClub}`,
          });
          teamsAffected.add(`${club} ${year}`);
        }

        if (slotPos && norm.position !== slotPos) {
          const ycPos = yc?.position;
          if (ycPos && ycPos === slotPos && raw.position !== slotPos) {
            // Already flagged via year card fix path
          } else if (!ycPos || ycPos !== slotPos) {
            positionMismatches.push({
              playerId,
              name: norm.name,
              kind: "era_slot_vs_natural",
              message: `${club} ${year}: natural ${norm.position} ≠ Wikipedia slot ${slotPos}`,
            });
            teamsAffected.add(`${club} ${year}`);
          }
        }
      }
    }
  }

  // ── Era team rating validation ────────────────────────────────────────
  const eraTeams = getAllEraTeams();
  const eraTeamRatings: Array<{
    displayName: string;
    teamRating: number;
    recomputed: number;
    teamValue: number;
    recomputedValue: number;
  }> = [];
  const eraRatingDrift: AuditEntry[] = [];

  for (const team of eraTeams) {
    const eraYear =
      team.category === "historic" ? Number(team.year) : undefined;
    const squad = buildEraSquadFromRoster(
      team.playerIds,
      team.slotPositions,
      eraYear
    );
    const recomputed = getAverageSquadRating(squad);
    const recomputedValue = getSquadValue(squad);

    eraTeamRatings.push({
      displayName: team.displayName,
      teamRating: team.teamRating,
      recomputed: Math.round(recomputed * 10) / 10,
      teamValue: team.teamValue,
      recomputedValue,
    });

    if (Math.abs(team.teamRating - recomputed) > 0.15) {
      eraRatingDrift.push({
        playerId: team.id,
        name: team.displayName,
        kind: "era_team_rating_drift",
        message: `Stored ${team.teamRating} vs recomputed ${recomputed.toFixed(1)}`,
      });
    }
  }

  // ── Write JSON fixes ──────────────────────────────────────────────────
  if (APPLY) {
    for (const { key, path } of FILES) {
      const players = byFile.get(key)!;
      writeFileSync(path, `${JSON.stringify(players, null, 2)}\n`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "report-only",
    playersAudited: allRaw.filter((p) => p.availableInGame !== false).length,
    ratingDistribution,
    elite90PlusCount: elite90Plus.length,
    ratingsChanged: ratingsChanged.length,
    valuesRecalculated: valuesRecalculated.length,
    yearCardsFixed: yearCardsFixed.length,
    flaggedNotChanged: flaggedNotChanged.length,
    clubYearMismatches: clubYearMismatches.length,
    positionMismatches: positionMismatches.length,
    duplicateYearCardGroups: duplicateYearCards.length,
    identicalYearRatingFlags: identicalYearRatings.length,
    overrideConflicts: overrideConflicts.length,
    eraTeamsValidated: eraTeams.length,
    eraRatingDrift: eraRatingDrift.length,
    teamsAffected: [...teamsAffected].sort(),
  };

  const report = {
    summary,
    ratingsChanged,
    valuesRecalculated,
    yearCardsFixed,
    flaggedNotChanged: flaggedNotChanged.slice(0, 200),
    clubYearMismatches,
    positionMismatches,
    duplicateYearCards,
    identicalYearRatings,
    overrideConflicts: overrideConflicts.slice(0, 100),
    elite90Plus: elite90Plus.sort((a, b) => b.message.localeCompare(a.message)),
    eraTeamRatings: eraTeamRatings.sort((a, b) => b.teamRating - a.teamRating),
    eraRatingDrift,
  };

  const reportPath = join(DATA, "player-rating-year-card-audit-report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  // Split reports
  writeFileSync(
    join(DATA, "rating-audit-club-year-mismatches.json"),
    `${JSON.stringify({ generatedAt: summary.generatedAt, clubYearMismatches }, null, 2)}\n`
  );
  writeFileSync(
    join(DATA, "rating-audit-position-mismatches.json"),
    `${JSON.stringify({ generatedAt: summary.generatedAt, positionMismatches }, null, 2)}\n`
  );
  writeFileSync(
    join(DATA, "rating-audit-manual-overrides.json"),
    `${JSON.stringify(
      {
        generatedAt: summary.generatedAt,
        overrideCount: Object.keys(PLAYER_RATING_OVERRIDES).length,
        jsonSynced: ratingsChanged.filter((e) => e.kind === "override_json_sync"),
        highRatingSuggestions: overrideConflicts,
        protectedOverrides: Object.entries(PLAYER_RATING_OVERRIDES).map(
          ([id, rating]) => ({ id, rating })
        ),
      },
      null,
      2
    )}\n`
  );

  console.log("Player rating & year-card audit\n");
  console.log(`Mode: ${APPLY ? "APPLY (fixes written)" : "REPORT ONLY (use --apply)"}`);
  console.log(`Players audited: ${summary.playersAudited}`);
  console.log(`Rating distribution:`, ratingDistribution);
  console.log(`90+ players: ${summary.elite90PlusCount}`);
  console.log(`Ratings changed: ${summary.ratingsChanged}`);
  console.log(`Values recalculated: ${summary.valuesRecalculated}`);
  console.log(`Year cards fixed: ${summary.yearCardsFixed}`);
  console.log(`Club/year mismatches: ${summary.clubYearMismatches}`);
  console.log(`Position mismatches: ${summary.positionMismatches}`);
  console.log(`Identical year-rating flags: ${summary.identicalYearRatingFlags}`);
  console.log(`Era teams validated: ${summary.eraTeamsValidated}`);
  console.log(`Report: ${reportPath}`);

  if (!APPLY && (valuesRecalculated.length > 0 || yearCardsFixed.length > 0)) {
    console.log("\nRe-run with --apply to write safe fixes.");
  }
}

main();
