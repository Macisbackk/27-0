/**
 * Validate player pool eligibility per game mode.
 * Run: npm run validate:player-pools
 */
import { writeFileSync } from "fs";
import { join } from "path";
import {
  CURRENT_PLAYABLE_CLUBS,
  auditModePool,
  getChallengeCupPool,
  getDraftPool,
  getFantasyPool,
  getGlobalRecruitmentPool,
  getHardModeGlobalPool,
  getMissingPlayableClubs,
  getNormalModeTeamYearPools,
  isEraOnlyGeneratedPlayer,
} from "../src/lib/game/player-pool-eligibility";
import { getRecruitablePlayers } from "../src/lib/players";
import { getEraClubsWithTeams } from "../src/lib/players/era-teams";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";

const ROOT = join(__dirname, "..");
const REPORT_PATH = join(ROOT, "data", "player-pools-validation-report.json");

function findDuplicateIds(): string[] {
  const ids = new Set<string>();
  const dupes: string[] = [];
  for (const player of getRecruitablePlayers()) {
    if (ids.has(player.id)) dupes.push(player.id);
    ids.add(player.id);
  }
  return dupes;
}

function findUnsafeDuplicateNames(): { name: string; ids: string[] }[] {
  const byName = new Map<string, string[]>();
  for (const player of getRecruitablePlayers()) {
    if (isEraOnlyGeneratedPlayer(player)) continue;
    const key = normalizePlayerNameKey(player.name);
    const list = byName.get(key) ?? [];
    list.push(player.id);
    byName.set(key, list);
  }
  return [...byName.entries()]
    .filter(([, ids]) => ids.length > 2)
    .map(([name, ids]) => ({ name, ids }));
}

function main(): void {
  const normal = auditModePool("normal");
  const hard = auditModePool("hard");
  const cup = auditModePool("challenge-cup");
  const fantasy = auditModePool("fantasy");
  const draft = auditModePool("draft");

  const globalPool = getGlobalRecruitmentPool();
  const missingNormalClubs = getMissingPlayableClubs(globalPool);
  const eraExcluded = getRecruitablePlayers()
    .filter(isEraOnlyGeneratedPlayer)
    .map((p) => ({
      id: p.id,
      name: p.name,
      reason: "era-only generated player excluded from Normal/Hard/Cup/Draft/Fantasy global pools",
    }));

  const errors: string[] = [];

  for (const club of CURRENT_PLAYABLE_CLUBS) {
    const count = hard.byClub[club] ?? 0;
    if (count === 0) {
      errors.push(`No eligible Normal Mode players for ${club} (global pool)`);
    }
  }

  for (const club of normal.missingClubs) {
    errors.push(`No team-year roster players for playable club: ${club}`);
  }

  const duplicateIds = findDuplicateIds();
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate player IDs: ${duplicateIds.join(", ")}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      normalModeGlobalTotal: globalPool.length,
      normalModeTeamYearPools: getNormalModeTeamYearPools().length,
      hardModePool: getHardModeGlobalPool().length,
      challengeCupPool: getChallengeCupPool().length,
      fantasyPool: getFantasyPool().length,
      draftPool: getDraftPool().length,
      eraChallengeCupTeams: getEraClubsWithTeams().length,
      eraOnlyExcludedFromGlobal: eraExcluded.length,
      errors: errors.length,
    },
    normalMode: normal,
    hardMode: hard,
    challengeCup: cup,
    fantasy,
    draft,
    missingNormalClubs,
    eraOnlyExcluded: eraExcluded.slice(0, 100),
    unsafeDuplicateNames: findUnsafeDuplicateNames().slice(0, 50),
    duplicateIds,
    errors,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Player pool validation\n");
  console.log(`Normal global pool: ${globalPool.length}`);
  console.log(`Normal team-year pools: ${report.summary.normalModeTeamYearPools}`);
  console.log(`Hard / Cup / Fantasy / Draft: ${hard.totalPlayers} / ${cup.totalPlayers} / ${fantasy.totalPlayers} / ${draft.totalPlayers}`);
  console.log(`Era Cup teams: ${report.summary.eraChallengeCupTeams}`);
  console.log(`Era-only excluded: ${eraExcluded.length}`);
  console.log("\nNormal Mode players by club (team-year unique IDs):");
  for (const club of CURRENT_PLAYABLE_CLUBS) {
    console.log(`  ${club}: ${normal.byClub[club] ?? 0}`);
  }
  console.log(`\nReport: ${REPORT_PATH}`);

  if (errors.length > 0) {
    console.error(`\n✗ ${errors.length} error(s):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log("\n✓ Player pool validation passed");
}

main();
