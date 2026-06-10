import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { normalizePlayerNameKey } from "../../../src/lib/player-name-normalize";

const USER_AGENT = "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const INDEX_PATH = join(__dirname, "..", "..", "..", "data", "superleague-player-index.json");

export interface SuperLeaguePlayerRecord {
  id: number;
  name: string;
  careerTries: number | null;
  careerAppearances: number | null;
  position: string | null;
}

export interface SuperLeaguePlayerIndex {
  builtAt: string;
  source: "superleague.co.uk";
  players: Record<string, SuperLeaguePlayerRecord>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parsePlayerPage(html: string, id: number): SuperLeaguePlayerRecord | null {
  const h2 = html.match(/<h2[^>]*>\s*([^<]+?)\s*<\/h2>/i)?.[1]?.trim();
  if (!h2 || h2 === "Partners" || h2.length < 3) return null;

  const stats = [...html.matchAll(
    /<p class="stat-total[^"]*"[^>]*>\s*(\d+)\s*<\/p>[\s\S]*?<h3>\s*([^<]+?)\s*<\/h3>/g
  )];

  let careerTries: number | null = null;
  let careerAppearances: number | null = null;
  for (const m of stats) {
    const value = Number(m[1]);
    const label = m[2].trim().toLowerCase();
    if (label.includes("super league career tries")) careerTries = value;
    if (label.includes("super league career appear")) careerAppearances = value;
  }

  const position = html.match(/<span>Position:<\/span>\s*([^<]+)/i)?.[1]?.trim() ?? null;

  return {
    id,
    name: h2,
    careerTries,
    careerAppearances,
    position,
  };
}

export function loadSuperLeagueIndex(): SuperLeaguePlayerIndex | null {
  if (!existsSync(INDEX_PATH)) return null;
  return JSON.parse(readFileSync(INDEX_PATH, "utf-8")) as SuperLeaguePlayerIndex;
}

export function saveSuperLeagueIndex(index: SuperLeaguePlayerIndex): void {
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
}

export async function buildSuperLeagueIndex(
  maxId = 2000,
  delayMs = 250
): Promise<SuperLeaguePlayerIndex> {
  const players: Record<string, SuperLeaguePlayerRecord> = {};

  for (let id = 1; id <= maxId; id++) {
    const res = await fetch(`https://www.superleague.co.uk/player/${id}/`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.status === 200) {
      const html = await res.text();
      const record = parsePlayerPage(html, id);
      if (record) {
        players[normalizePlayerNameKey(record.name)] = record;
      }
    }
    if (id % 100 === 0) {
      console.log(`  SL index: scanned ${id}/${maxId}, found ${Object.keys(players).length}`);
      saveSuperLeagueIndex({
        builtAt: new Date().toISOString(),
        source: "superleague.co.uk",
        players,
      });
    }
    await sleep(delayMs);
  }

  const index: SuperLeaguePlayerIndex = {
    builtAt: new Date().toISOString(),
    source: "superleague.co.uk",
    players,
  };
  saveSuperLeagueIndex(index);
  return index;
}

export function lookupSuperLeaguePlayer(
  playerName: string,
  index: SuperLeaguePlayerIndex
): SuperLeaguePlayerRecord | null {
  return index.players[normalizePlayerNameKey(playerName)] ?? null;
}
