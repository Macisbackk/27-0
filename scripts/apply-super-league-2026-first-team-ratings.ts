/**
 * Apply 2026 Super League first-team FIFA-style ratings import.
 *
 * ONLY reads:
 *   data/imports/super_league_2026_first_team_ratings_cursor_import.json
 *
 * Updates (matched eligible players only):
 *   - data/current-squads.json peakRating + value
 *   - data/player-rating-overrides.ts + .json
 *   - data/player-potential-overrides.ts (+ potentialOverrides in rating-overrides.json)
 *
 * Never touches historic-players, legends, championship squads/templates,
 * reserves, or excludedPlayers from the import.
 *
 * Run: npx tsx scripts/apply-super-league-2026-first-team-ratings.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ratingToValue } from "../src/lib/players/ratings";
import { ERA_26_CURRENT_CLUBS } from "../src/lib/players/era-teams";

const ROOT = join(__dirname, "..");

/** Hardcoded — never use the old wrong filename. */
const IMPORT_PATH = join(
  ROOT,
  "data/imports/super_league_2026_first_team_ratings_cursor_import.json"
);
const REPORT_PATH = join(
  ROOT,
  "data/imports/super_league_2026_first_team_ratings_apply-report.json"
);
const CURRENT_SQUADS_PATH = join(ROOT, "data/current-squads.json");
const RATING_OVERRIDES_TS = join(ROOT, "data/player-rating-overrides.ts");
const RATING_OVERRIDES_JSON = join(ROOT, "data/player-rating-overrides.json");
const POTENTIAL_OVERRIDES_TS = join(ROOT, "data/player-potential-overrides.ts");

const SL_CLUBS = new Set<string>(ERA_26_CURRENT_CLUBS);

/** Import name → DB name (current first-team only). Keys/values are normaliseName()'d. */
const NAME_ALIASES: Record<string, string> = {
  "oliver ashall bott": "olly ashall bott",
  "george flanagan": "george flanagan jr",
};

type ImportPlayer = {
  name: string;
  club: string;
  position?: string;
  overall: number;
  potential: number;
  sourceSquadStatus?: string;
  updateEligible: boolean;
};

type ImportFile = {
  eligiblePlayerCount: number;
  excludedPlayerCount: number;
  players: ImportPlayer[];
  excludedPlayers: ImportPlayer[];
};

type SquadPlayer = {
  id: string;
  name: string;
  club?: string;
  team?: string;
  displayClub?: string;
  category?: string;
  peakRating: number;
  value: number;
  position?: string;
  [key: string]: unknown;
};

type MatchResult =
  | { status: "matched"; player: SquadPlayer; via: string }
  | { status: "ambiguous"; candidates: SquadPlayer[]; via: string }
  | { status: "unmatched" };

function clampRating(n: number): number {
  return Math.max(75, Math.min(99, Math.round(n)));
}

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseClub(club: string): string {
  return club
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function playerClub(p: SquadPlayer): string {
  return String(p.club ?? p.displayClub ?? p.team ?? "");
}

function isCurrentSl(p: SquadPlayer): boolean {
  return p.category === "current" && SL_CLUBS.has(playerClub(p));
}

function upsertTsRecord(
  filePath: string,
  exportName: string,
  entries: Record<string, number>
): void {
  let src = readFileSync(filePath, "utf8");
  for (const [id, value] of Object.entries(entries)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`("${escaped}":\\s*)\\d+`);
    if (re.test(src)) {
      src = src.replace(re, `$1${value}`);
    } else {
      const marker = `export const ${exportName}`;
      const idx = src.indexOf(marker);
      if (idx < 0) throw new Error(`Missing ${exportName} in ${filePath}`);
      const brace = src.indexOf("{", idx);
      src =
        src.slice(0, brace + 1) +
        `\n  "${id}": ${value},` +
        src.slice(brace + 1);
    }
  }
  writeFileSync(filePath, src);
}

function matchImportPlayer(
  imp: ImportPlayer,
  byNameClub: Map<string, SquadPlayer[]>,
  byNameSl: Map<string, SquadPlayer[]>
): MatchResult {
  const aliasTarget = NAME_ALIASES[normaliseName(imp.name)];
  const namesToTry = aliasTarget
    ? [aliasTarget, normaliseName(imp.name)]
    : [normaliseName(imp.name)];
  const clubKey = normaliseClub(imp.club);

  for (const nameKey of namesToTry) {
    const clubMatches = byNameClub.get(`${nameKey}||${clubKey}`) ?? [];
    if (clubMatches.length === 1) {
      return {
        status: "matched",
        player: clubMatches[0]!,
        via: aliasTarget ? "alias+club" : "name+club",
      };
    }
    if (clubMatches.length > 1) {
      return {
        status: "ambiguous",
        candidates: clubMatches,
        via: "name+club",
      };
    }
  }

  for (const nameKey of namesToTry) {
    const nameMatches = byNameSl.get(nameKey) ?? [];
    if (nameMatches.length === 1) {
      return {
        status: "matched",
        player: nameMatches[0]!,
        via: aliasTarget ? "alias+unique-sl-name" : "unique-sl-name",
      };
    }
    if (nameMatches.length > 1) {
      return {
        status: "ambiguous",
        candidates: nameMatches,
        via: "unique-sl-name",
      };
    }
  }

  return { status: "unmatched" };
}

function main(): void {
  const importData = JSON.parse(
    readFileSync(IMPORT_PATH, "utf8")
  ) as ImportFile;

  if (importData.eligiblePlayerCount !== 345) {
    throw new Error(
      `Expected eligiblePlayerCount=345, got ${importData.eligiblePlayerCount}`
    );
  }
  if (importData.excludedPlayerCount !== 149) {
    throw new Error(
      `Expected excludedPlayerCount=149, got ${importData.excludedPlayerCount}`
    );
  }

  const eligible = importData.players.filter((p) => p.updateEligible === true);
  if (eligible.length !== importData.players.length) {
    console.warn(
      `Warning: ${importData.players.length - eligible.length} players had updateEligible !== true`
    );
  }

  const excludedIdsSnapshot = new Set(
    (importData.excludedPlayers ?? []).map(
      (p) => `${normaliseName(p.name)}||${normaliseClub(p.club)}`
    )
  );

  const squads = JSON.parse(
    readFileSync(CURRENT_SQUADS_PATH, "utf8")
  ) as SquadPlayer[];

  const currentPlayers = squads.filter((p) => p.category === "current");
  const beforeById = new Map(
    currentPlayers.map((p) => [
      p.id,
      { peakRating: p.peakRating, value: p.value },
    ])
  );

  const byNameClub = new Map<string, SquadPlayer[]>();
  const byNameSl = new Map<string, SquadPlayer[]>();

  for (const p of currentPlayers) {
    if (!isCurrentSl(p)) continue;
    const nk = normaliseName(p.name);
    const ck = normaliseClub(playerClub(p));
    const clubKey = `${nk}||${ck}`;
    const clubList = byNameClub.get(clubKey) ?? [];
    clubList.push(p);
    byNameClub.set(clubKey, clubList);

    const nameList = byNameSl.get(nk) ?? [];
    nameList.push(p);
    byNameSl.set(nk, nameList);
  }

  const ratingUpdates: Record<string, number> = {};
  const potentialUpdates: Record<string, number> = {};
  const updated: Array<Record<string, unknown>> = [];
  const unmatched: Array<Record<string, unknown>> = [];
  const ambiguous: Array<Record<string, unknown>> = [];
  const touchedIds = new Set<string>();

  for (const imp of eligible) {
    let overall = clampRating(imp.overall);
    let potential = clampRating(imp.potential);
    if (potential < overall) potential = overall;

    const result = matchImportPlayer(imp, byNameClub, byNameSl);

    if (result.status === "unmatched") {
      unmatched.push({
        name: imp.name,
        club: imp.club,
        overall,
        potential,
      });
      continue;
    }

    if (result.status === "ambiguous") {
      console.warn(
        `AMBIGUOUS: ${imp.name} (${imp.club}) via ${result.via}: ${result.candidates
          .map((c) => c.id)
          .join(", ")}`
      );
      ambiguous.push({
        name: imp.name,
        club: imp.club,
        overall,
        potential,
        via: result.via,
        candidateIds: result.candidates.map((c) => c.id),
      });
      continue;
    }

    const player = result.player;
    const before = beforeById.get(player.id)!;
    player.peakRating = overall;
    player.value = ratingToValue(overall);
    ratingUpdates[player.id] = overall;
    potentialUpdates[player.id] = potential;
    touchedIds.add(player.id);
    updated.push({
      id: player.id,
      name: player.name,
      club: playerClub(player),
      importName: imp.name,
      via: result.via,
      overallBefore: before.peakRating,
      overallAfter: overall,
      valueBefore: before.value,
      valueAfter: player.value,
      potential,
    });
  }

  writeFileSync(
    CURRENT_SQUADS_PATH,
    `${JSON.stringify(squads, null, 2)}\n`,
    "utf8"
  );

  upsertTsRecord(RATING_OVERRIDES_TS, "PLAYER_RATING_OVERRIDES", ratingUpdates);
  upsertTsRecord(
    POTENTIAL_OVERRIDES_TS,
    "PLAYER_POTENTIAL_OVERRIDES",
    potentialUpdates
  );

  const ratingJson = JSON.parse(
    readFileSync(RATING_OVERRIDES_JSON, "utf8")
  ) as {
    overrides: Record<string, number>;
    potentialOverrides?: Record<string, number>;
    [key: string]: unknown;
  };
  Object.assign(ratingJson.overrides, ratingUpdates);
  ratingJson.potentialOverrides = {
    ...(ratingJson.potentialOverrides ?? {}),
    ...potentialUpdates,
  };
  writeFileSync(
    RATING_OVERRIDES_JSON,
    `${JSON.stringify(ratingJson, null, 2)}\n`,
    "utf8"
  );

  // Audit: no excluded import row should map to a touched player via name+club.
  const excludedTouched: string[] = [];
  for (const key of excludedIdsSnapshot) {
    // We never iterate excludedPlayers for writes; this confirms no touched
    // player shares an excluded import name+club key.
    const [exName, exClub] = key.split("||");
    for (const row of updated) {
      if (
        normaliseName(String(row.importName)) === exName &&
        normaliseClub(String(row.club)) === exClub
      ) {
        excludedTouched.push(String(row.id));
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    importPath:
      "data/imports/super_league_2026_first_team_ratings_cursor_import.json",
    eligiblePlayerCount: importData.eligiblePlayerCount,
    excludedPlayerCount: importData.excludedPlayerCount,
    processedEligible: eligible.length,
    updated: updated.length,
    unmatched: unmatched.length,
    ambiguous: ambiguous.length,
    excludedUntouched: excludedTouched.length === 0,
    excludedTouchedIds: excludedTouched,
    ratingOverrideCount: Object.keys(ratingUpdates).length,
    potentialOverrideCount: Object.keys(potentialUpdates).length,
    requiredChecks: {
      "Bevan French": updated.find((u) => u.id === "wigan-cur-bevan-french"),
      "Mikey Lewis": updated.find((u) => u.id === "hull-kr-cur-mikey-lewis"),
      "Jack Welsby": updated.find((u) => u.id === "st-helens-cur-jack-welsby"),
      "Joe Mellor": updated.find((u) => u.id === "bradford-cur-joe-mellor"),
      "Olly Ashall-Bott": updated.find(
        (u) => u.id === "toulouse-cur-olly-ashall-bott"
      ),
      "George Flanagan Jr": updated.find(
        (u) => u.id === "huddersfield-cur-george-flanagan-jr"
      ),
      "Zach Eckersley": updated.find(
        (u) => u.id === "wigan-cur-zach-eckersley"
      ),
    },
    updatedPlayers: updated,
    unmatchedPlayers: unmatched,
    ambiguousPlayers: ambiguous,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Updated:    ${updated.length}`);
  console.log(`Unmatched:  ${unmatched.length}`);
  console.log(`Ambiguous:  ${ambiguous.length}`);
  console.log(`Excluded untouched: ${excludedTouched.length === 0}`);
  console.log(`Report → ${REPORT_PATH}`);
}

main();
