/**
 * Enrich retired player records from Rugby League Project list export.
 * Updates only fields directly present on RLP (appearances, tries) — no guessing.
 * Run: npx tsx scripts/enrich-retired-from-rlp.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const TARGET_FILES = ["historic-players.json", "legends.json"] as const;

const RLP_POS_MAP: Record<string, string> = {
  FB: "FULLBACK",
  W: "WING",
  C: "CENTRE",
  FE: "STAND_OFF",
  HB: "SCRUM_HALF",
  FR: "PROP",
  HK: "HOOKER",
  "2R": "SECOND_ROW",
  L: "LOOSE_FORWARD",
};

const GAME_POS_TO_LABEL: Record<string, string> = {
  FULLBACK: "Fullback",
  WING: "Wing",
  CENTRE: "Centre",
  STAND_OFF: "Stand Off",
  SCRUM_HALF: "Scrum Half",
  PROP: "Prop",
  HOOKER: "Hooker",
  SECOND_ROW: "Second Row",
  LOOSE_FORWARD: "Loose Forward",
};

type RawPlayer = {
  id: string;
  name: string;
  nationality: string;
  position: string;
  club: string;
  yearsActive: string;
  category: string;
  appearances?: number;
  tries?: number;
};

interface RlpRow {
  name: string;
  dob: string;
  totalApps: number;
  tries: number | null;
  primaryPosition: string | null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatName(rlpName: string): string {
  const m = rlpName.match(/^(.+?),\s*(.+)$/);
  if (!m) return rlpName;
  const surname = m[1]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  const first = m[2]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  return `${first} ${surname}`;
}

function parseNum(val: string): number | null {
  if (!val || val === "-") return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function extractRowCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<td[^>]*>([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(m[1].trim());
  }
  return cells;
}

function parsePositions(raw: string): { code: string; apps: number }[] {
  return raw.split(",").map((part) => {
    const [code, appsStr] = part.trim().split("-");
    return { code: code.trim(), apps: parseInt(appsStr, 10) || 0 };
  });
}

function pickPosition(positions: { code: string; apps: number }[]): string | null {
  const playable = positions.filter((p) => RLP_POS_MAP[p.code]);
  if (playable.length === 0) return null;
  playable.sort((a, b) => b.apps - a.apps);
  return RLP_POS_MAP[playable[0].code];
}

function parseRlpList(html: string): Map<string, RlpRow> {
  const map = new Map<string, RlpRow>();
  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  const tbody = html.slice(tbodyStart, tbodyEnd);
  const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);

  for (let i = 1; i < parts.length; i += 2) {
    const chunk = parts[i + 1];
    if (!chunk) continue;

    const nameMatch = chunk.match(/^([^<]+)<\/a>([\s\S]*)$/);
    if (!nameMatch) continue;

    const cells = extractRowCells(nameMatch[2]);
    if (cells.length < 11) continue;

    const dob = cells[0];
    const posRaw = cells[2];
    const totalApps = parseNum(cells[5]) ?? 0;
    const tries = parseNum(cells[10]);

    const row: RlpRow = {
      name: formatName(nameMatch[1]),
      dob,
      totalApps,
      tries,
      primaryPosition: pickPosition(parsePositions(posRaw)),
    };

    map.set(normalizeName(row.name), row);
  }

  return map;
}

function needsAppearances(player: RawPlayer): boolean {
  return player.appearances === undefined || player.appearances === null || player.appearances === 0;
}

function needsTries(player: RawPlayer): boolean {
  return player.tries === undefined || player.tries === null;
}

function main() {
  const listHtml = readFileSync(HTML_PATH, "utf-8");
  const rlpByName = parseRlpList(listHtml);

  let appsUpdated = 0;
  let triesUpdated = 0;
  let positionUpdated = 0;
  let matched = 0;
  let noMatch = 0;

  for (const file of TARGET_FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
    let fileChanged = false;

    for (const player of players) {
      const rlp = rlpByName.get(normalizeName(player.name));
      if (!rlp) {
        noMatch++;
        continue;
      }
      matched++;

      if (needsAppearances(player) && rlp.totalApps > 0) {
        player.appearances = rlp.totalApps;
        appsUpdated++;
        fileChanged = true;
      }

      if (needsTries(player) && rlp.tries !== null && rlp.tries >= 0) {
        player.tries = rlp.tries;
        triesUpdated++;
        fileChanged = true;
      }

      if (
        rlp.primaryPosition &&
        (!player.position ||
          player.position === "Unknown" ||
          player.position === "")
      ) {
        const label = GAME_POS_TO_LABEL[rlp.primaryPosition];
        if (label) {
          player.position = label;
          positionUpdated++;
          fileChanged = true;
        }
      }
    }

    if (fileChanged) {
      writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
    }
    console.log(`  ${file}: ${fileChanged ? "updated" : "unchanged"}`);
  }

  console.log("\nRetired enrichment from RLP list:");
  console.log(`  Matched players: ${matched}`);
  console.log(`  No RLP match: ${noMatch}`);
  console.log(`  Appearances updated: ${appsUpdated}`);
  console.log(`  Tries updated: ${triesUpdated}`);
  console.log(`  Position updated: ${positionUpdated}`);
}

main();
