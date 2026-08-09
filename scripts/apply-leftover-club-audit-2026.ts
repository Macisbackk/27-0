/**
 * Apply leftover club-move audit fixes:
 * - Move in-DB players to correct 2026 clubs
 * - Park QLD Cup player (Sironen) on system-only club, out of game pools
 * - Convert retired players to historic 2026 cards (out of manager Current pools)
 * - Remove unresolved phantom Salford Current cards
 *
 * Run: npx tsx scripts/apply-leftover-club-audit-2026.ts
 * Then: npm run build:player-chunks
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const HISTORIC_PATH = join(ROOT, "data", "historic-players.json");
const TEAM_YEAR_PATH = join(ROOT, "data", "current-team-year-squads-2026.json");
const RATING_TS = join(ROOT, "data", "player-rating-overrides.ts");
const RATING_JSON = join(ROOT, "data", "player-rating-overrides.json");
const POTENTIAL_TS = join(ROOT, "data", "player-potential-overrides.ts");
const BIRTH_YEARS = join(ROOT, "data", "birth-years.json");
const CHAMP_PATH = join(ROOT, "data", "championship-clubs.json");
const CLUBS_PATH = join(ROOT, "data", "clubs.json");
const REPORT_PATH = join(
  ROOT,
  "data",
  "current-club-moves-leftovers-applied-2026.json"
);

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

const MOVES: { fromId: string; toClub: string; reason: string; outOfGame?: boolean }[] =
  [
    {
      fromId: "salford-cur-mitch-clark",
      toClub: "York Knights",
      reason:
        "Committed to York for 2026 Super League; wrongly on liquidated Salford card",
    },
    {
      fromId: "salford-cur-ellis-robson",
      toClub: "Barrow Raiders",
      reason: "Signed Barrow Raiders (Championship) from 2025 two-year deal",
    },
    {
      fromId: "catalans-cur-bayley-sironen",
      toClub: "Wynnum Manly Seagulls",
      reason:
        "Left Catalans for Queensland Cup Wynnum Manly — system club only, not in game pools",
      outOfGame: true,
    },
  ];

const RETIRE_TO_HISTORIC_2026: {
  fromId: string;
  reason: string;
}[] = [
  {
    fromId: "salford-cur-ben-hellewell",
    reason: "Retired Aug 2025 (hip replacement) — historic 2026 card, out of manager Current",
  },
];

const REMOVE_PHANTOMS: { id: string; reason: string }[] = [
  {
    id: "salford-cur-brodie-shields",
    reason:
      "No pro record; likely corruption of Jimmy Shields (Swinton then released). Remove unresolved Current card",
  },
  {
    id: "salford-cur-chris-savelio",
    reason: "No RLP/pro record; not in 2025 Salford SL usage list",
  },
  {
    id: "salford-cur-ryan-kingston",
    reason: "No verified 2026 destination; not in 2025 Salford SL usage list",
  },
  {
    id: "salford-cur-sitili-ngahe",
    reason: "No verified 2026 destination; not in 2025 Salford SL usage list",
  },
  {
    id: "salford-cur-dele-sule",
    reason: "No verified 2026 destination; not in 2025 Salford SL usage list",
  },
  {
    id: "salford-cur-logan-ewington",
    reason: "No verified 2026 destination; not in 2025 Salford SL usage list",
  },
  {
    id: "salford-cur-tim-bergin",
    reason: "Stale/bad Current card (DOB 1985); no verified 2026 club",
  },
];

type Player = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  basePlayerId?: string;
  peakRating?: number;
  value?: number;
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

function makeHistoricId(club: string, name: string, year: number): string {
  const slug = ID_CLUB_SLUG[club] ?? slugifyClubFull(club);
  return `${slug}-hist-${slugifyName(name)}-${year}`;
}

function retargetKeyFile(path: string, idMap: Map<string, string>): number {
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
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
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

function deleteOverrideKeys(path: string, ids: string[], isTs: boolean): number {
  if (!existsSync(path)) return 0;
  if (isTs) {
    let text = readFileSync(path, "utf8");
    let changed = 0;
    for (const id of ids) {
      const re = new RegExp(
        `\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*[^,\\n]+,?\\n?`,
        "g"
      );
      const next = text.replace(re, "");
      if (next !== text) {
        changed++;
        text = next;
      }
    }
    if (changed > 0) writeFileSync(path, text);
    return changed;
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  let changed = 0;
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(data, id)) {
      delete data[id];
      changed++;
    }
    const pot = data.potentialOverrides as Record<string, unknown> | undefined;
    if (pot && Object.prototype.hasOwnProperty.call(pot, id)) {
      delete pot[id];
      changed++;
    }
  }
  if (changed > 0) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return changed;
}

function verifyChampionshipClubs(): {
  count: number;
  names: string[];
  ok: boolean;
  note: string;
} {
  const champOnly = JSON.parse(readFileSync(CHAMP_PATH, "utf8")) as { name: string }[];
  const clubs = JSON.parse(readFileSync(CLUBS_PATH, "utf8")) as {
    id: string;
    name: string;
    competitionTier2026?: string;
  }[];
  const embedded = clubs
    .filter((c) => c.competitionTier2026 === "championship")
    .map((c) => c.name);
  const names = [...new Set([...champOnly.map((c) => c.name), ...embedded])].sort();
  const expected = 20;
  return {
    count: names.length,
    names,
    ok: names.length === expected,
    note:
      names.length === expected
        ? "All 20 Championship clubs present (championship-clubs.json + embedded London/Widnes/Halifax/Sheffield/Oldham)."
        : `Expected ${expected} Championship clubs, found ${names.length}`,
  };
}

function main() {
  const championshipCheck = verifyChampionshipClubs();
  let players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Player[];
  const historic = JSON.parse(readFileSync(HISTORIC_PATH, "utf8")) as Player[];
  const byId = new Map(players.map((p) => [p.id, p]));
  const idMap = new Map<string, string>();
  const removedIds: string[] = [];

  const appliedMoves: Record<string, unknown>[] = [];
  const retired: Record<string, unknown>[] = [];
  const removed: Record<string, unknown>[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const move of MOVES) {
    const player = byId.get(move.fromId);
    if (!player) {
      skipped.push({ id: move.fromId, reason: "not found in current-squads" });
      continue;
    }
    if (player.club === move.toClub && !move.outOfGame) {
      skipped.push({ id: move.fromId, reason: `already at ${move.toClub}` });
      continue;
    }
    const toId = makeId(move.toClub, player.name);
    if (byId.has(toId) && toId !== move.fromId) {
      skipped.push({
        id: move.fromId,
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
    if (move.outOfGame) {
      player.availableInGame = false;
      player.superLeagueEligible = false;
    }
    const clubsPlayed = Array.isArray(player.clubsPlayedFor)
      ? ([...(player.clubsPlayedFor as string[])] as string[])
      : [];
    if (!clubsPlayed.includes(fromClub)) clubsPlayed.push(fromClub);
    if (!clubsPlayed.includes(move.toClub)) clubsPlayed.push(move.toClub);
    player.clubsPlayedFor = clubsPlayed;

    byId.delete(fromId);
    byId.set(toId, player);
    idMap.set(fromId, toId);
    appliedMoves.push({
      name: player.name,
      fromId,
      toId,
      fromClub,
      toClub: move.toClub,
      reason: move.reason,
      availableInGame: move.outOfGame ? false : true,
    });
  }

  for (const ret of RETIRE_TO_HISTORIC_2026) {
    const player = byId.get(ret.fromId);
    if (!player) {
      skipped.push({ id: ret.fromId, reason: "not found for retire" });
      continue;
    }
    const club = "Salford Red Devils";
    const histId = makeHistoricId(club, player.name, 2026);
    if (historic.some((h) => h.id === histId)) {
      skipped.push({ id: ret.fromId, reason: `historic id already exists: ${histId}` });
      byId.delete(ret.fromId);
      removedIds.push(ret.fromId);
      continue;
    }
    const histCard: Player = {
      ...player,
      id: histId,
      basePlayerId: `${ID_CLUB_SLUG[club]}-hist-${slugifyName(player.name)}`,
      category: "historic",
      status: "Historic",
      year: 2026,
      cardYear: 2026,
      yearsActive: "2026–2026",
      club,
      team: club,
      displayClub: club,
      currentClub: club,
      teamYearId: `${slugifyClubFull(club)}-2026`,
      availableInGame: true,
      source: "leftover-club-audit-retire-2026",
    };
    delete (histCard as { availableInGame?: boolean }).availableInGame;
    // Historic cards are recruitable in historic modes; manager uses category===current only.
    histCard.availableInGame = true;

    historic.push(histCard);
    byId.delete(ret.fromId);
    removedIds.push(ret.fromId);
    idMap.set(ret.fromId, histId);
    retired.push({
      name: player.name,
      fromId: ret.fromId,
      toId: histId,
      reason: ret.reason,
    });
  }

  for (const ph of REMOVE_PHANTOMS) {
    const player = byId.get(ph.id);
    if (!player) {
      skipped.push({ id: ph.id, reason: "phantom already absent" });
      continue;
    }
    byId.delete(ph.id);
    removedIds.push(ph.id);
    removed.push({ id: ph.id, name: player.name, reason: ph.reason });
  }

  players = [...byId.values()];
  writeFileSync(CURRENT_PATH, JSON.stringify(players, null, 2) + "\n");
  writeFileSync(HISTORIC_PATH, JSON.stringify(historic, null, 2) + "\n");

  // Rebuild SL 2026 team-year id lists for playable SL clubs
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
    const slClubs = [
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
    ];
    for (const club of slClubs) {
      const slug = slugifyClubFull(club);
      const ids = players.filter((p) => p.club === club).map((p) => p.id);
      if (!teamYear[slug]) teamYear[slug] = {};
      const existing = teamYear[slug]!["2026"];
      teamYear[slug]!["2026"] = {
        playerIds: ids,
        positions: existing?.positions ?? [],
        source: existing?.source ?? "leftover-club-audit-2026",
        isCurrentSeason: true,
        isSuperLeagueSeason: true,
      };
    }
    writeFileSync(TEAM_YEAR_PATH, JSON.stringify(teamYear, null, 2) + "\n");
  }

  const ratingTsHits = retargetKeyFile(RATING_TS, idMap);
  const ratingJsonHits = retargetJsonRecord(RATING_JSON, idMap);
  const potTsHits = retargetKeyFile(POTENTIAL_TS, idMap);
  const birthHits = retargetJsonRecord(BIRTH_YEARS, idMap);
  const delTs = deleteOverrideKeys(RATING_TS, removedIds, true);
  const delJson = deleteOverrideKeys(RATING_JSON, removedIds, false);
  const delPot = deleteOverrideKeys(POTENTIAL_TS, removedIds, true);
  const delBirth = deleteOverrideKeys(BIRTH_YEARS, removedIds, false);

  const salfordLeft = players.filter(
    (p) =>
      p.club === "Salford Red Devils" ||
      String(p.id).startsWith("salford-cur-")
  );

  const report = {
    generatedAt: new Date().toISOString(),
    championshipCheck,
    appliedMoves,
    retiredToHistoric2026: retired,
    removedPhantoms: removed,
    skipped,
    salfordCurrentRemaining: salfordLeft.map((p) => ({
      id: p.id,
      name: p.name,
      club: p.club,
    })),
    sidecarRetargets: {
      ratingTsHits,
      ratingJsonHits,
      potTsHits,
      birthHits,
      deletedOverrideKeys: delTs + delJson + delPot + delBirth,
    },
    notes: [
      "Championship clubs already complete at 20 — no Featherstone (by design).",
      "Wynnum Manly Seagulls added as qld_cup system club (not playable / not in game).",
      "Bayley Sironen parked on Wynnum Manly with availableInGame=false.",
      "Ben Hellewell removed from Current/manager pools; historic 2026 card added.",
      "Run npm run build:player-chunks after this script.",
    ],
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

  console.log(championshipCheck.note);
  console.log(`Moved ${appliedMoves.length}`);
  for (const a of appliedMoves) {
    console.log(`  ${a.name}: ${a.fromClub} -> ${a.toClub}`);
  }
  console.log(`Retired to historic 2026: ${retired.length}`);
  console.log(`Removed phantoms: ${removed.length}`);
  console.log(`Salford Current remaining: ${salfordLeft.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main();
