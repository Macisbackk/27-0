/**
 * Enrich player database using ONLY:
 * - Wikipedia (en.wikipedia.org)
 * - Official Super League website (superleague.co.uk)
 *
 * Run:
 *   npx tsx scripts/enrich-allowed-sources.ts --build-sl-index
 *   npx tsx scripts/enrich-allowed-sources.ts --enrich
 *   npx tsx scripts/enrich-allowed-sources.ts --build-sl-index --enrich
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { normalizePlayerNameKey } from "../src/lib/player-name-normalize";
import { fetchWikipediaPlayer } from "./lib/sources/wikipedia-player";
import {
  buildSuperLeagueIndex,
  loadSuperLeagueIndex,
  lookupSuperLeaguePlayer,
} from "./lib/sources/superleague-player";

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  category?: string;
  nationality?: string;
  yearsActive?: string;
  appearances?: number;
  tries?: number;
};

const DATA_DIR = join(__dirname, "..", "data");
const REPORT_PATH = join(DATA_DIR, "enrichment-source-report.json");
const TARGET_FILES = [
  "current-squads.json",
  "historic-players.json",
  "legends.json",
] as const;

const WIKI_DELAY_MS = 800;
const args = new Set(process.argv.slice(2));

interface FieldUpdate {
  field: string;
  from: unknown;
  to: unknown;
  source: "Wikipedia" | "Official Super League website";
}

interface PlayerReport {
  id: string;
  name: string;
  file: string;
  updates: FieldUpdate[];
}

interface EnrichmentReport {
  generatedAt: string;
  allowedSources: string[];
  bannedSources: string[];
  playersUpdated: PlayerReport[];
  stillMissing: Array<{
    id: string;
    name: string;
    file: string;
    missing: string[];
  }>;
  duplicatesRemoved: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isMissing(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "Unknown"
  );
}

function loadPlayers(file: string): RawPlayer[] {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as RawPlayer[];
}

function savePlayers(file: string, players: RawPlayer[]): void {
  writeFileSync(join(DATA_DIR, file), JSON.stringify(players, null, 2) + "\n");
}

function findDuplicatesAcrossFiles(): Map<string, RawPlayer[]> {
  const byName = new Map<string, RawPlayer[]>();
  for (const file of TARGET_FILES) {
    for (const p of loadPlayers(file)) {
      const key = normalizePlayerNameKey(p.name);
      const list = byName.get(key) ?? [];
      list.push({ ...p, category: p.category ?? file.replace(".json", "") });
      byName.set(key, list);
    }
  }
  return byName;
}

function removeDuplicates(): string[] {
  const removed: string[] = [];
  const byName = findDuplicatesAcrossFiles();
  const priority: Record<string, number> = {
    "current-squads.json": 3,
    "legends.json": 2,
    "historic-players.json": 1,
  };

  for (const [, entries] of byName) {
    if (entries.length <= 1) continue;
    const grouped = new Map<string, RawPlayer[]>();
    for (const file of TARGET_FILES) {
      const filePlayers = loadPlayers(file).filter((p) =>
        entries.some((e) => e.id === p.id)
      );
      if (filePlayers.length > 0) grouped.set(file, filePlayers);
    }
    if ([...grouped.values()].flat().length <= 1) continue;

    const all = [...grouped.entries()].flatMap(([file, players]) =>
      players.map((p) => ({ file, player: p }))
    );
    all.sort(
      (a, b) =>
        (priority[b.file] ?? 0) - (priority[a.file] ?? 0) ||
        ((b.player.peakRating as number) ?? 0) - ((a.player.peakRating as number) ?? 0)
    );
    const keeper = all[0];
    for (const { file, player } of all.slice(1)) {
      const players = loadPlayers(file);
      const next = players.filter((p) => p.id !== player.id);
      if (next.length < players.length) {
        savePlayers(file, next);
        removed.push(`${player.name} (${player.id}) from ${file}`);
      }
    }
    void keeper;
  }
  return removed;
}

async function enrichPlayer(
  player: RawPlayer,
  slIndex: ReturnType<typeof loadSuperLeagueIndex>
): Promise<FieldUpdate[]> {
  const updates: FieldUpdate[] = [];
  const isCurrent = player.category === "current";

  const sl =
    isCurrent && slIndex
      ? lookupSuperLeaguePlayer(player.name, slIndex)
      : null;

  if (sl) {
    if (isMissing(player.appearances) && sl.careerAppearances !== null) {
      updates.push({
        field: "appearances",
        from: player.appearances ?? "Unknown",
        to: sl.careerAppearances,
        source: "Official Super League website",
      });
      player.appearances = sl.careerAppearances;
    }
    if (isMissing(player.tries) && sl.careerTries !== null) {
      updates.push({
        field: "tries",
        from: player.tries ?? "Unknown",
        to: sl.careerTries,
        source: "Official Super League website",
      });
      player.tries = sl.careerTries;
    }
  }

  const needsWiki =
    isMissing(player.nationality) ||
    isMissing(player.yearsActive) ||
    (isCurrent && isMissing(player.appearances)) ||
    (!isCurrent && (isMissing(player.appearances) || isMissing(player.tries)));

  if (needsWiki) {
    await sleep(WIKI_DELAY_MS);
    const wiki = await fetchWikipediaPlayer(player.name, {
      currentClub: player.club,
      isCurrent: player.category === "current",
    });

    if (wiki) {
      if (isMissing(player.nationality) && wiki.nationality) {
        updates.push({
          field: "nationality",
          from: player.nationality ?? "Unknown",
          to: wiki.nationality,
          source: "Wikipedia",
        });
        player.nationality = wiki.nationality;
      }
      if (isMissing(player.yearsActive) && wiki.yearsActive) {
        updates.push({
          field: "yearsActive",
          from: player.yearsActive ?? "Unknown",
          to: wiki.yearsActive,
          source: "Wikipedia",
        });
        player.yearsActive = wiki.yearsActive;
      }
      if (isMissing(player.appearances) && wiki.appearances !== null) {
        updates.push({
          field: "appearances",
          from: player.appearances ?? "Unknown",
          to: wiki.appearances,
          source: "Wikipedia",
        });
        player.appearances = wiki.appearances;
      }
      if (isMissing(player.tries) && wiki.tries !== null) {
        updates.push({
          field: "tries",
          from: player.tries ?? "Unknown",
          to: wiki.tries,
          source: "Wikipedia",
        });
        player.tries = wiki.tries;
      }
    }
  }

  if (player.category === "current" && player.yearsActive && !player.yearsActive.includes("Present")) {
    if (!/\d{4}–\d{4}/.test(player.yearsActive)) {
      const start = player.yearsActive.match(/\d{4}/)?.[0];
      if (start) {
        const next = `${start}–Present`;
        updates.push({
          field: "yearsActive",
          from: player.yearsActive,
          to: next,
          source: "Wikipedia",
        });
        player.yearsActive = next;
      }
    }
  }

  return updates;
}

function collectStillMissing(
  file: string,
  players: RawPlayer[]
): EnrichmentReport["stillMissing"] {
  return players
    .map((p) => {
      const missing: string[] = [];
      if (isMissing(p.nationality)) missing.push("nationality");
      if (isMissing(p.appearances)) missing.push("appearances");
      if (isMissing(p.tries)) missing.push("tries");
      if (isMissing(p.yearsActive)) missing.push("yearsActive");
      if (missing.length === 0) return null;
      return { id: p.id, name: p.name, file, missing };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

async function main() {
  const report: EnrichmentReport = {
    generatedAt: new Date().toISOString(),
    allowedSources: ["Wikipedia", "Official Super League website"],
    bannedSources: [
      "Rugby League Project",
      "Club websites",
      "Fan databases",
      "News websites",
      "Forums",
      "AI estimates",
    ],
    playersUpdated: [],
    stillMissing: [],
    duplicatesRemoved: [],
  };

  if (args.has("--dedupe")) {
    report.duplicatesRemoved = removeDuplicates();
    console.log(`Removed ${report.duplicatesRemoved.length} duplicate records`);
  }

  if (args.has("--build-sl-index")) {
    console.log("Building Super League player index from superleague.co.uk…");
    await buildSuperLeagueIndex(2000, 200);
    console.log("SL index built.");
  }

  if (args.has("--enrich")) {
    const slIndex = loadSuperLeagueIndex();
    if (!slIndex) {
      console.warn("No SL index found — run with --build-sl-index first for current player SL stats.");
    } else {
      console.log(`SL index loaded: ${Object.keys(slIndex.players).length} players`);
    }

    for (const file of TARGET_FILES) {
      const players = loadPlayers(file);
      let fileChanged = false;
      console.log(`\nEnriching ${file} (${players.length} players)…`);

      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const needsWork =
          isMissing(player.nationality) ||
          isMissing(player.appearances) ||
          isMissing(player.tries) ||
          isMissing(player.yearsActive);
        if (!needsWork) continue;

        const updates = await enrichPlayer(player, slIndex);
        if (updates.length > 0) {
          fileChanged = true;
          report.playersUpdated.push({
            id: player.id,
            name: player.name,
            file,
            updates,
          });
        }

        if (report.playersUpdated.length % 25 === 0 && fileChanged) {
          savePlayers(file, players);
        }
      }

      if (fileChanged) savePlayers(file, players);
      report.stillMissing.push(...collectStillMissing(file, players));
      console.log(`  Updated in ${file}: ${report.playersUpdated.filter((p) => p.file === file).length}`);
    }
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log(`Players updated: ${report.playersUpdated.length}`);
  console.log(`Still missing data: ${report.stillMissing.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
