/**
 * Audit Current SL squads vs live Fantasy SL roster.
 * Run: npx tsx scripts/audit-current-club-placements-2026.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const FANTASY_MD = join(
  ROOT,
  "..",
  ".cursor",
  "projects",
  "c-Users-Macis-Projects-27-0",
  "agent-tools",
  "dcfc4def-a36c-41de-921a-26b50ec483d7.txt"
);
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const OUT_PATH = join(ROOT, "data", "current-squad-club-audit-2026.json");

const SL_CLUBS = new Set([
  "Bradford Bulls",
  "Castleford Tigers",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Hull FC",
  "Hull KR",
  "Leeds Rhinos",
  "Leigh Leopards",
  "St Helens",
  "Toulouse Olympique",
  "Wakefield Trinity",
  "Warrington Wolves",
  "Wigan Warriors",
  "York Knights",
]);

const POS_SUFFIXES = [
  "Full Back",
  "Winger",
  "Centre",
  "Stand Off",
  "Scrum Half",
  "Prop",
  "Hooker",
  "Second Row",
  "Loose Forward",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripPosition(raw: string): string {
  let name = raw.trim();
  for (const pos of POS_SUFFIXES) {
    if (name.endsWith(pos)) {
      name = name.slice(0, -pos.length).trim();
      break;
    }
  }
  return name;
}

type Player = {
  id: string;
  name: string;
  club: string;
  peakRating?: number;
  category?: string;
};

function loadFantasyNames(path: string): Set<string> {
  const text = readFileSync(path, "utf8");
  const names = new Set<string>();
  for (const line of text.split("\n")) {
    // | | NamePos | ...
    const m = line.match(/^\|\s*\|\s*([^|]+)\|/);
    if (!m) continue;
    const cell = m[1].trim();
    if (!cell || cell === "Name" || cell.startsWith("--")) continue;
    const name = stripPosition(cell);
    if (name.length < 3) continue;
    names.add(norm(name));
  }
  return names;
}

function main() {
  let fantasyPath = FANTASY_MD;
  try {
    readFileSync(fantasyPath, "utf8");
  } catch {
    // Fall back to workspace-relative if agent-tools path differs
    fantasyPath = join(
      process.env.USERPROFILE || "",
      ".cursor",
      "projects",
      "c-Users-Macis-Projects-27-0",
      "agent-tools",
      "dcfc4def-a36c-41de-921a-26b50ec483d7.txt"
    );
  }

  const fantasy = loadFantasyNames(fantasyPath);
  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Player[];

  const slPlayers = players.filter((p) => SL_CLUBS.has(p.club));
  const salford = players.filter((p) => p.club === "Salford Red Devils");
  const champRemnants = players.filter((p) =>
    ["Oldham RLFC", "Sheffield Eagles", "London Broncos"].includes(p.club)
  );

  const missing: {
    id: string;
    name: string;
    club: string;
    peakRating: number | null;
  }[] = [];

  let matched = 0;
  for (const p of slPlayers) {
    if (fantasy.has(norm(p.name))) {
      matched++;
    } else {
      missing.push({
        id: p.id,
        name: p.name,
        club: p.club,
        peakRating: p.peakRating ?? null,
      });
    }
  }

  missing.sort((a, b) => a.club.localeCompare(b.club) || a.name.localeCompare(b.name));

  const report = {
    generatedAt: new Date().toISOString(),
    fantasyNameCount: fantasy.size,
    slPlayerCount: slPlayers.length,
    matchedCount: matched,
    missingCount: missing.length,
    slPlayersMissingFromFantasy: missing,
    salfordRedDevilsPlayers: salford.map((p) => ({
      id: p.id,
      name: p.name,
      peakRating: p.peakRating ?? null,
    })),
    championshipRemnantPlayers: champRemnants.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club,
      peakRating: p.peakRating ?? null,
    })),
  };

  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(
    `Fantasy names: ${fantasy.size}; SL current: ${slPlayers.length}; matched: ${matched}; missing: ${missing.length}`
  );
  console.log(`Salford Red Devils leftover: ${salford.length}`);
  console.log(`Wrote ${OUT_PATH}`);
  for (const row of missing) {
    console.log(`  ${row.club} | ${row.name} | ${row.id} | ${row.peakRating}`);
  }
}

main();
