/**
 * Audit and apply Super League / Challenge Cup trophy flags using ONLY:
 * - Wikipedia (final winner squad navboxes)
 * - Official Super League website (cross-check via superleague player index when present)
 *
 * Does NOT modify man-of-steel-winners.json or Man of Steel achievements.
 *
 * Run:
 *   npx tsx scripts/apply-trophy-achievements.ts --build-cache
 *   npx tsx scripts/apply-trophy-achievements.ts --apply
 *   npx tsx scripts/apply-trophy-achievements.ts --build-cache --apply
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import {
  buildTrophyWinnerCache,
  fetchWikipediaWikitext,
  parsePlayerTrophyHonours,
  trophyWinnerNameKey,
  type TrophyWinnerCache,
} from "./lib/sources/wikipedia-trophies";
import { loadSuperLeagueIndex } from "./lib/sources/superleague-player";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const CACHE_PATH = join(DATA, "trophy-winners-cache.json");
const REPORT_PATH = join(DATA, "trophy-achievements-report.json");

const TARGET_FILES = [
  "current-squads.json",
  "historic-players.json",
  "legends.json",
] as const;

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
};

interface PlayerChange {
  id: string;
  name: string;
  file: string;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
  sources: string[];
}

interface TrophyReport {
  generatedAt: string;
  allowedSources: string[];
  cacheBuiltAt: string | null;
  superLeagueWinnersInCache: number;
  challengeCupWinnersInCache: number;
  playersUpdated: PlayerChange[];
  trophiesAdded: {
    superLeague: string[];
    challengeCup: string[];
  };
  trophiesRemoved: {
    superLeague: string[];
    challengeCup: string[];
  };
  manualReview: Array<{
    id: string;
    name: string;
    file: string;
    reason: string;
  }>;
}

const args = new Set(process.argv.slice(2));

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function saveJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function loadPlayers(file: string): RawPlayer[] {
  const raw = loadJson<unknown>(join(DATA, file));
  if (Array.isArray(raw)) return raw as RawPlayer[];
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, RawPlayer[]>).flat();
  }
  return [];
}

function savePlayers(file: string, players: RawPlayer[]): void {
  const path = join(DATA, file);
  const raw = loadJson<unknown>(path);
  if (Array.isArray(raw)) {
    saveJson(path, players);
    return;
  }
  if (raw && typeof raw === "object") {
    const out: Record<string, RawPlayer[]> = {};
    for (const [key, list] of Object.entries(raw as Record<string, RawPlayer[]>)) {
      const ids = new Set(list.map((p) => p.id));
      out[key] = players.filter((p) => ids.has(p.id));
    }
    saveJson(path, out);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (args.has("--build-cache")) {
    console.log("Building trophy winner cache from Wikipedia finals…");
    const cache = await buildTrophyWinnerCache({ delayMs: 1200 });
    saveJson(CACHE_PATH, cache);
    console.log(
      `Cache: ${cache.superLeagueWinners.length} SL, ${cache.challengeCupWinners.length} CC`
    );
    if (cache.parseFailures.length) {
      console.log(`Parse failures: ${cache.parseFailures.length}`);
    }
  }

  if (!args.has("--apply")) return;

  if (!existsSync(CACHE_PATH)) {
    console.error("No cache found. Run with --build-cache first.");
    process.exit(1);
  }

  const cache = loadJson<TrophyWinnerCache>(CACHE_PATH);
  const slKeys = new Set(cache.superLeagueWinners.map((n) => trophyWinnerNameKey(n)));
  const ccKeys = new Set(cache.challengeCupWinners.map((n) => trophyWinnerNameKey(n)));

  const slIndex = loadSuperLeagueIndex();
  const report: TrophyReport = {
    generatedAt: new Date().toISOString(),
    allowedSources: ["Wikipedia", "Official Super League website"],
    cacheBuiltAt: cache.builtAt,
    superLeagueWinnersInCache: cache.superLeagueWinners.length,
    challengeCupWinnersInCache: cache.challengeCupWinners.length,
    playersUpdated: [],
    trophiesAdded: { superLeague: [], challengeCup: [] },
    trophiesRemoved: { superLeague: [], challengeCup: [] },
    manualReview: [],
  };

  for (const file of TARGET_FILES) {
    const players = loadPlayers(file);
    let changed = false;

    for (const player of players) {
      const key = trophyWinnerNameKey(player.name);
      const prevSl = Boolean(player.superLeagueWinner);
      const prevCc = Boolean(player.challengeCupWinner);

      let nextSl = slKeys.has(key);
      let nextCc = ccKeys.has(key);
      const sources: string[] = [];

      if (nextSl || nextCc) {
        sources.push("Wikipedia");
        if (slIndex?.players[key]) {
          sources.push("Official Super League website");
        }
      }

      if (!nextSl && !nextCc && (prevSl || prevCc)) {
        await sleep(900);
        const wiki = await fetchWikipediaWikitext(player.name);
        if (wiki) {
          const honours = parsePlayerTrophyHonours(wiki);
          if (honours.superLeague) {
            nextSl = true;
            sources.push("Wikipedia");
          }
          if (honours.challengeCup) {
            nextCc = true;
            sources.push("Wikipedia");
          }
        }
        if ((prevSl && !nextSl) || (prevCc && !nextCc)) {
          report.manualReview.push({
            id: player.id,
            name: player.name,
            file,
            reason: `Removed unconfirmed flag (was SL:${prevSl} CC:${prevCc})`,
          });
        }
      }

      if (nextSl !== prevSl || nextCc !== prevCc) {
        player.superLeagueWinner = nextSl;
        player.challengeCupWinner = nextCc;
        changed = true;
        report.playersUpdated.push({
          id: player.id,
          name: player.name,
          file,
          superLeagueWinner: nextSl,
          challengeCupWinner: nextCc,
          sources,
        });
        if (nextSl && !prevSl) report.trophiesAdded.superLeague.push(player.name);
        if (nextCc && !prevCc) report.trophiesAdded.challengeCup.push(player.name);
        if (!nextSl && prevSl) report.trophiesRemoved.superLeague.push(player.name);
        if (!nextCc && prevCc) report.trophiesRemoved.challengeCup.push(player.name);
      }
    }

    if (changed) savePlayers(file, players);
    console.log(`Applied ${file}: ${report.playersUpdated.filter((p) => p.file === file).length} changes`);
  }

  report.trophiesAdded.superLeague.sort();
  report.trophiesAdded.challengeCup.sort();
  report.trophiesRemoved.superLeague.sort();
  report.trophiesRemoved.challengeCup.sort();

  saveJson(REPORT_PATH, report);
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Updated: ${report.playersUpdated.length}`);
  console.log(`SL added: ${report.trophiesAdded.superLeague.length}, removed: ${report.trophiesRemoved.superLeague.length}`);
  console.log(`CC added: ${report.trophiesAdded.challengeCup.length}, removed: ${report.trophiesRemoved.challengeCup.length}`);
  console.log(`Manual review: ${report.manualReview.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
