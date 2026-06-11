/**
 * Import missing Super League players from Rugby League Project export.
 * Source: scripts/rlp-players.html (downloaded from RLP Super League players page)
 * Run: npx tsx scripts/import-rlp-players.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");

/** RLP team codes → 27-0 club names (clubs.json) */
const RLP_CLUB_MAP: Record<string, string> = {
  WIG: "Wigan Warriors",
  STH: "St Helens",
  LEE: "Leeds Rhinos",
  WAR: "Warrington Wolves",
  WOL: "Warrington Wolves",
  BRA: "Bradford Bulls",
  CAT: "Catalans Dragons",
  HUL: "Hull FC",
  HFC: "Hull FC",
  HKR: "Hull KR",
  LEI: "Leigh Leopards",
  WAK: "Wakefield Trinity",
  WTN: "Wakefield Trinity",
  CAS: "Castleford Tigers",
  HUD: "Huddersfield Giants",
  SAL: "Salford Red Devils",
  LON: "London Broncos",
  WID: "Widnes Vikings",
  TOU: "Toulouse Olympique",
  YOR: "York Knights",
  OLD: "Oldham RLFC",
  PSG: "Paris Saint-Germain RL",
  HAL: "Halifax Panthers",
  SHE: "Sheffield Eagles",
  GAT: "Gateshead Thunder",
  CRU: "Crusaders RL",
};

/** RLP position codes → game position */
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

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  category: string;
};

interface RlpPlayer {
  rlpId: string;
  name: string;
  dob: string;
  teams: { code: string; apps: number }[];
  positions: { code: string; apps: number }[];
  totalApps: number;
  tries: number | null;
  wins: number;
  losses: number;
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

function parseTeams(raw: string): { code: string; apps: number }[] {
  return raw.split(",").map((part) => {
    const [code, appsStr] = part.trim().split("-");
    return { code: code.trim(), apps: parseInt(appsStr, 10) || 0 };
  });
}

function parsePositions(raw: string): { code: string; apps: number }[] {
  return raw.split(",").map((part) => {
    const [code, appsStr] = part.trim().split("-");
    return { code: code.trim(), apps: parseInt(appsStr, 10) || 0 };
  });
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

function parseHtml(html: string): RlpPlayer[] {
  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  const tbody = html.slice(tbodyStart, tbodyEnd);
  const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);
  const players: RlpPlayer[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const rlpId = parts[i];
    const chunk = parts[i + 1];
    if (!chunk) continue;

    const nameMatch = chunk.match(/^([^<]+)<\/a>([\s\S]*)$/);
    if (!nameMatch) continue;

    const cells = extractRowCells(nameMatch[2]);
    if (cells.length < 12) continue;

    const dob = cells[0];
    const teamsRaw = cells[1];
    const posRaw = cells[2];
    const totalApps = parseNum(cells[5]) ?? 0;
    const wins = parseNum(cells[6]) ?? 0;
    const losses = parseNum(cells[7]) ?? 0;
    const tries = parseNum(cells[10]);

    players.push({
      rlpId,
      name: formatName(nameMatch[1]),
      dob,
      teams: parseTeams(teamsRaw),
      positions: parsePositions(posRaw),
      totalApps,
      tries,
      wins,
      losses,
    });
  }

  return players;
}

function pickClub(teams: { code: string; apps: number }[]): string | null {
  let best: { club: string; apps: number } | null = null;
  for (const t of teams) {
    const club = RLP_CLUB_MAP[t.code];
    if (!club) continue;
    if (!best || t.apps > best.apps) best = { club, apps: t.apps };
  }
  return best?.club ?? null;
}

function pickPosition(positions: { code: string; apps: number }[]): string | null {
  const playable = positions.filter((p) => RLP_POS_MAP[p.code]);
  if (playable.length === 0) return null;
  playable.sort((a, b) => b.apps - a.apps);
  return RLP_POS_MAP[playable[0].code];
}

function clubSlug(club: string): string {
  const map: Record<string, string> = {
    "Wigan Warriors": "wigan",
    "St Helens": "st-helens",
    "Leeds Rhinos": "leeds",
    "Warrington Wolves": "warrington",
    "Bradford Bulls": "bradford",
    "Catalans Dragons": "catalans",
    "Hull FC": "hull-fc",
    "Hull KR": "hull-kr",
    "Leigh Leopards": "leigh",
    "Wakefield Trinity": "wakefield",
    "Castleford Tigers": "castleford",
    "Huddersfield Giants": "huddersfield",
    "Salford Red Devils": "salford",
    "London Broncos": "london",
    "Widnes Vikings": "widnes",
    "Halifax Panthers": "halifax",
    "York Knights": "york",
    "Toulouse Olympique": "toulouse",
    "Sheffield Eagles": "sheffield",
    "Oldham RLFC": "oldham",
    "Paris Saint-Germain RL": "psg",
    "Gateshead Thunder": "gateshead",
    "Crusaders RL": "crusaders",
  };
  return map[club] ?? club.toLowerCase().replace(/\s+/g, "-");
}

function nameSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function estimateRawRating(p: RlpPlayer, category: string): number {
  const apps = p.totalApps;
  const tries = p.tries ?? 0;
  const winPct = apps > 0 ? p.wins / apps : 0;
  const tryRate = apps > 0 ? tries / apps : 0;

  let score = 68;
  score += Math.min(apps / 35, 10);
  score += Math.min(tries / 20, 8);
  score += winPct * 6;
  score += tryRate * 25;

  if (category === "legend") score += 10;
  if (category === "current") score -= 6;
  if (category === "historic" && apps < 60) score -= 4;

  return Math.round(Math.max(66, Math.min(96, score)));
}

function compressRating(raw: number, category: string): number {
  const bounds: Record<string, [number, number]> = {
    current: [66, 93],
    historic: [70, 96],
    legend: [88, 99],
  };
  const output: Record<string, [number, number]> = {
    current: [75, 88],
    historic: [78, 94],
    legend: [92, 99],
  };
  const [inMin, inMax] = bounds[category] ?? [66, 98];
  const [outMin, outMax] = output[category] ?? [75, 88];
  const t = (Math.max(inMin, Math.min(inMax, raw)) - inMin) / (inMax - inMin);
  let r = Math.round(outMin + t * (outMax - outMin));
  if (category === "legend") r = Math.max(92, Math.min(99, r));
  else if (category === "historic") r = Math.max(78, Math.min(94, r));
  else r = Math.max(75, Math.min(88, r));
  return r;
}

function ratingToValue(rating: number): number {
  const normalized = (rating - 75) / 24;
  const value = Math.pow(normalized, 1.85) * 4_800_000 + 120_000;
  return Math.round(value / 5_000) * 5_000;
}

function inferCategory(p: RlpPlayer): "current" | "historic" | "legend" | null {
  const birthYear = parseInt(p.dob.slice(0, 4), 10);
  const apps = p.totalApps;
  const tries = p.tries ?? 0;
  const winPct = apps > 0 ? p.wins / apps : 0;

  const isLegend =
    apps >= 220 &&
    birthYear <= 1988 &&
    (tries >= 70 || (winPct >= 0.58 && apps >= 280));

  if (isLegend) return "legend";

  const isCurrent =
    birthYear >= 1998 &&
    apps >= 10 &&
    apps <= 160;

  if (isCurrent) return "current";
  if (apps >= 25) return "historic";
  return null;
}

function inferYearsActive(p: RlpPlayer, category: string): string {
  const birthYear = parseInt(p.dob.slice(0, 4), 10);
  const debutEstimate = birthYear + 18;
  if (category === "current") return `${debutEstimate}–Present`;
  const retireEstimate = birthYear + 36;
  return `${debutEstimate}–${retireEstimate}`;
}

function inferEra(category: string, birthYear: number): string {
  if (category === "current") return "CONTEMPORARY_ERA";
  if (birthYear >= 1985) return "MODERN_ERA";
  if (birthYear >= 1975) return "EARLY_DOMINANCE";
  return "SUPER_LEAGUE_ORIGINS";
}

function loadExisting(): { names: Set<string>; ids: Set<string> } {
  const files = ["current-squads.json", "historic-players.json", "legends.json"];
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const file of files) {
    const players = JSON.parse(
      readFileSync(join(DATA_DIR, file), "utf-8")
    ) as RawPlayer[];
    for (const p of players) {
      names.add(normalizeName(p.name));
      ids.add(p.id);
    }
  }
  return { names, ids };
}

function main() {
  const html = readFileSync(HTML_PATH, "utf-8");
  const rlpPlayers = parseHtml(html);
  const existing = loadExisting();

  const current: RawPlayer[] = [];
  const historic: RawPlayer[] = [];
  const legend: RawPlayer[] = [];
  const skipped: string[] = [];

  for (const p of rlpPlayers) {
    const norm = normalizeName(p.name);
    if (existing.names.has(norm)) continue;

    const club = pickClub(p.teams);
    if (!club) {
      skipped.push(`${p.name} (no mapped SL club)`);
      continue;
    }

    const slApps = p.teams
      .filter((t) => RLP_CLUB_MAP[t.code])
      .reduce((s, t) => s + t.apps, 0);
    if (slApps < 10) {
      skipped.push(`${p.name} (<10 SL apps)`);
      continue;
    }

    const position = pickPosition(p.positions);
    if (!position) {
      skipped.push(`${p.name} (no mappable position)`);
      continue;
    }

    const category = inferCategory(p);
    if (!category) {
      skipped.push(`${p.name} (category unclear)`);
      continue;
    }

    const birthYear = parseInt(p.dob.slice(0, 4), 10);
    const prefix =
      category === "current" ? "cur" : category === "legend" ? "leg" : "hist";
    const id = `${clubSlug(club)}-${prefix}-${nameSlug(p.name)}`;
    if (existing.ids.has(id)) continue;

    const rawRating = estimateRawRating(p, category);
    const peakRating = compressRating(rawRating, category);
    const value = ratingToValue(peakRating);

    const entry: RawPlayer = {
      id,
      name: p.name,
      position,
      club,
      nationality: "Unknown",
      era: inferEra(category, birthYear),
      yearsActive: inferYearsActive(p, category),
      category,
      peakRating,
      value,
      rating: peakRating,
      intlCaps: 0,
    };

    if (p.tries !== null) {
      entry.appearances = p.totalApps;
      entry.tries = p.tries;
    }

    if (category === "historic") entry.clubLegend = false;
    if (category === "legend") {
      entry.clubLegend = true;
      entry.manOfSteel = false;
      entry.challengeCupWinner = false;
      entry.superLeagueWinner = false;
    }

    if (category === "current") current.push(entry);
    else if (category === "legend") legend.push(entry);
    else historic.push(entry);

    existing.names.add(norm);
    existing.ids.add(id);
  }

  const additions = { current, historic, legend };
  writeFileSync(
    join(DATA_DIR, "player-additions.json"),
    JSON.stringify(additions, null, 2) + "\n"
  );

  console.log(`RLP players parsed: ${rlpPlayers.length}`);
  console.log(`New current: ${current.length}`);
  console.log(`New historic: ${historic.length}`);
  console.log(`New legend: ${legend.length}`);
  console.log(`Skipped: ${skipped.length}`);
  if (skipped.length > 0 && skipped.length <= 30) {
    skipped.forEach((s) => console.log(`  - ${s}`));
  } else if (skipped.length > 30) {
    skipped.slice(0, 15).forEach((s) => console.log(`  - ${s}`));
    console.log(`  ... and ${skipped.length - 15} more`);
  }
}

main();
