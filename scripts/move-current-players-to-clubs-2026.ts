/**
 * Move existing Current players to their real 2026 clubs.
 * Only relocates players already in data/current-squads.json — never invents players.
 *
 * Run: npx tsx scripts/move-current-players-to-clubs-2026.ts
 * Then: npm run build:player-chunks
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const SL_SQUADS_PATH = join(ROOT, "data", "sl-2026-squads.json");
const TEAM_YEAR_PATH = join(ROOT, "data", "current-team-year-squads-2026.json");
const RATING_TS = join(ROOT, "data", "player-rating-overrides.ts");
const RATING_JSON = join(ROOT, "data", "player-rating-overrides.json");
const POTENTIAL_TS = join(ROOT, "data", "player-potential-overrides.ts");
const BIRTH_YEARS = join(ROOT, "data", "birth-years.json");
const REPORT_PATH = join(ROOT, "data", "current-club-moves-2026-report.json");

const ID_CLUB_SLUG: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Wigan Warriors": "wigan",
  "York Knights": "york",
  "Salford Red Devils": "salford",
  "London Broncos": "london",
  "Widnes Vikings": "widnes",
  "Halifax Panthers": "halifax",
  "Sheffield Eagles": "sheffield",
  "Oldham RLFC": "oldham",
  "Midlands Hurricanes": "midlands",
  "Salford RLFC": "salford-rlfc",
  "Rochdale Hornets": "rochdale",
  "Barrow Raiders": "barrow",
  "Dewsbury Rams": "dewsbury",
  "Doncaster RLFC": "doncaster",
  "Goole Vikings": "goole",
  "Swinton Lions": "swinton",
  "Hunslet RLFC": "hunslet",
  "Keighley Cougars": "keighley",
  "Batley Bulldogs": "batley",
  "Whitehaven": "whitehaven",
  "Workington Town": "workington",
  "Newcastle Thunder": "newcastle",
  "North Wales Crusaders": "north-wales",
  "Wynnum Manly Seagulls": "wynnum-manly",
};

/** Confirmed 2026 placements for players already in our Current DB. */
const MOVES: { fromId: string; toClub: string; reason: string }[] = [
  {
    fromId: "huddersfield-cur-jake-bibby",
    toClub: "Oldham RLFC",
    reason: "Released by Huddersfield; permanent Oldham Championship signing for 2026",
  },
  {
    fromId: "castleford-cur-jeremiah-simbiken",
    toClub: "London Broncos",
    reason: "Castleford → London Broncos Championship for 2026",
  },
  {
    fromId: "oldham-cur-zach-jebson",
    toClub: "Midlands Hurricanes",
    reason: "Hull FC exit → Midlands Hurricanes (was wrongly on Oldham remnant)",
  },
  {
    fromId: "salford-cur-toby-warren",
    toClub: "Midlands Hurricanes",
    reason: "Leeds release / Salford liquidation → Midlands Hurricanes",
  },
  {
    fromId: "salford-cur-nathan-connell",
    toClub: "Widnes Vikings",
    reason: "Salford liquidation → Widnes Vikings",
  },
  {
    fromId: "salford-cur-kai-morgan",
    toClub: "Sheffield Eagles",
    reason: "Salford liquidation → Sheffield Eagles",
  },
  {
    fromId: "salford-cur-shane-wright",
    toClub: "St Helens",
    reason: "Salford liquidation → St Helens (active SL fantasy)",
  },
  {
    fromId: "salford-cur-joe-shorrocks",
    toClub: "St Helens",
    reason: "Salford liquidation → St Helens (active SL fantasy)",
  },
  {
    fromId: "salford-cur-jonny-vaughan",
    toClub: "Wigan Warriors",
    reason: "Signed for Wigan from Saints path; was on liquidated Salford card",
  },
  {
    fromId: "london-cur-dayon-sambou",
    toClub: "Wigan Warriors",
    reason: "Joined Wigan with Vaughan; was on London remnant card",
  },
];

type Player = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  basePlayerId?: string;
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugifyClubFull(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeId(club: string, name: string): string {
  const slug = ID_CLUB_SLUG[club];
  if (!slug) throw new Error(`No id slug for club ${club}`);
  return `${slug}-cur-${slugifyName(name)}`;
}

function retargetKeyFile(
  path: string,
  isTs: boolean,
  exportName: string | null,
  idMap: Map<string, string>
): number {
  if (!existsSync(path)) return 0;
  let text = readFileSync(path, "utf8");
  let changed = 0;
  for (const [oldId, newId] of idMap) {
    if (oldId === newId) continue;
    const re = new RegExp(
      `("${oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}")`,
      "g"
    );
    const next = text.replace(re, `"${newId}"`);
    if (next !== text) {
      changed++;
      text = next;
    }
  }
  if (changed > 0) writeFileSync(path, text);
  return changed;
}

function retargetJsonRecord(path: string, idMap: Map<string, string>): number {
  if (!existsSync(path)) return 0;
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  let changed = 0;
  for (const [oldId, newId] of idMap) {
    if (oldId === newId) continue;
    if (Object.prototype.hasOwnProperty.call(data, oldId)) {
      if (!Object.prototype.hasOwnProperty.call(data, newId)) {
        data[newId] = data[oldId];
      }
      delete data[oldId];
      changed++;
    }
    // nested potentialOverrides
    const pot = data.potentialOverrides as Record<string, unknown> | undefined;
    if (pot && Object.prototype.hasOwnProperty.call(pot, oldId)) {
      if (!Object.prototype.hasOwnProperty.call(pot, newId)) {
        pot[newId] = pot[oldId];
      }
      delete pot[oldId];
      changed++;
    }
  }
  if (changed > 0) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return changed;
}

function main() {
  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Player[];
  const byId = new Map(players.map((p) => [p.id, p]));
  const idMap = new Map<string, string>();
  const applied: {
    name: string;
    fromId: string;
    toId: string;
    fromClub: string;
    toClub: string;
    reason: string;
  }[] = [];
  const skipped: { fromId: string; reason: string }[] = [];

  for (const move of MOVES) {
    const player = byId.get(move.fromId);
    if (!player) {
      skipped.push({ fromId: move.fromId, reason: "not found in current-squads" });
      continue;
    }
    if (player.club === move.toClub) {
      skipped.push({ fromId: move.fromId, reason: `already at ${move.toClub}` });
      continue;
    }
    const toId = makeId(move.toClub, player.name);
    if (byId.has(toId) && toId !== move.fromId) {
      skipped.push({
        fromId: move.fromId,
        reason: `destination id already exists: ${toId}`,
      });
      continue;
    }

    const fromClub = player.club;
    const fromId = player.id;
    player.id = toId;
    player.basePlayerId = toId;
    player.club = move.toClub;
    player.team = move.toClub;
    player.displayClub = move.toClub;
    player.currentClub = move.toClub;
    player.teamYearId = `${slugifyClubFull(move.toClub)}-2026`;
    player.year = 2026;
    player.cardYear = 2026;
    player.status = "Current";
    player.category = "current";
    const clubsPlayed = Array.isArray(player.clubsPlayedFor)
      ? (player.clubsPlayedFor as string[])
      : [];
    if (!clubsPlayed.includes(fromClub)) clubsPlayed.push(fromClub);
    if (!clubsPlayed.includes(move.toClub)) clubsPlayed.push(move.toClub);
    player.clubsPlayedFor = clubsPlayed;

    byId.delete(fromId);
    byId.set(toId, player);
    idMap.set(fromId, toId);
    applied.push({
      name: player.name,
      fromId,
      toId,
      fromClub,
      toClub: move.toClub,
      reason: move.reason,
    });
  }

  writeFileSync(CURRENT_PATH, JSON.stringify(players, null, 2) + "\n");

  // Strip moved names from SL 2026 squad lists
  if (existsSync(SL_SQUADS_PATH)) {
    const sl = JSON.parse(readFileSync(SL_SQUADS_PATH, "utf8")) as Record<
      string,
      { name: string; positions?: string; rating?: number }[]
    >;
    const movedNames = new Set(
      applied.map((a) => a.name.toLowerCase())
    );
    for (const club of Object.keys(sl)) {
      sl[club] = (sl[club] ?? []).filter(
        (row) => !movedNames.has(row.name.toLowerCase())
      );
    }
    writeFileSync(SL_SQUADS_PATH, JSON.stringify(sl, null, 2) + "\n");
  }

  // Rebuild team-year id lists from current squads for SL clubs only
  if (existsSync(TEAM_YEAR_PATH)) {
    const teamYear = JSON.parse(readFileSync(TEAM_YEAR_PATH, "utf8")) as Record<
      string,
      Record<
        string,
        {
          playerIds: string[];
          positions: string[];
          source: string;
          isCurrentSeason: boolean;
          isSuperLeagueSeason: boolean;
        }
      >
    >;
    const slClubs = new Set(Object.keys(ID_CLUB_SLUG).filter((c) =>
      [
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
      ].includes(c)
    ));
    for (const club of slClubs) {
      const slug = slugifyClubFull(club);
      const ids = players
        .filter((p) => p.club === club)
        .map((p) => p.id);
      if (!teamYear[slug]) teamYear[slug] = {};
      const existing = teamYear[slug]!["2026"];
      teamYear[slug]!["2026"] = {
        playerIds: ids,
        positions: existing?.positions ?? [],
        source: existing?.source ?? "current-club-moves-2026",
        isCurrentSeason: true,
        isSuperLeagueSeason: true,
      };
    }
    writeFileSync(TEAM_YEAR_PATH, JSON.stringify(teamYear, null, 2) + "\n");
  }

  const ratingTsHits = retargetKeyFile(
    RATING_TS,
    true,
    "PLAYER_RATING_OVERRIDES",
    idMap
  );
  const ratingJsonHits = retargetJsonRecord(RATING_JSON, idMap);
  const potTsHits = retargetKeyFile(
    POTENTIAL_TS,
    true,
    "PLAYER_POTENTIAL_OVERRIDES",
    idMap
  );
  const birthHits = retargetJsonRecord(BIRTH_YEARS, idMap);

  const report = {
    generatedAt: new Date().toISOString(),
    applied,
    skipped,
    sidecarRetargets: {
      ratingTsHits,
      ratingJsonHits,
      potTsHits,
      birthHits,
    },
    notes: [
      "Bayley Sironen left Catalans for Queensland Cup (Wynnum Manly) — no Championship club in DB; left in place.",
      "Josh Simm (Catalans→Oldham) and Jack Walker (→Oldham) are not in current-squads — not added.",
      "Most off-season SL→Championship academy/depth movers are not in the Current DB.",
      "Run npm run build:player-chunks after this script.",
    ],
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log(`Moved ${applied.length} players:`);
  for (const a of applied) {
    console.log(`  ${a.name}: ${a.fromClub} → ${a.toClub} (${a.fromId} → ${a.toId})`);
  }
  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  ${s.fromId}: ${s.reason}`);
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
