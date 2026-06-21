/**
 * Apply Super League era verified squads + year-specific player cards.
 * Sources: Wikipedia season squad tables (sl-era-verified-squads.json).
 *
 * Run: npx tsx scripts/apply-sl-era-year-cards.ts && npm run merge:players
 *      npm run build:team-year-rosters
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import verifiedSquads from "../data/sl-era-verified-squads.json";
import type { Position } from "../src/lib/types";

type RawPlayer = Record<string, unknown> & { id: string };
type VerifiedSquads = Record<
  string,
  Record<
    string,
    {
      source: string;
      playerIds: string[];
      positions: Position[];
      wikipediaPlayers: string[];
    }
  >
>;

const DATA_DIR = join(process.cwd(), "data");
const ADDITIONS_PATH = join(DATA_DIR, "player-additions.json");
const ERA_SQUADS_PATH = join(DATA_DIR, "era-wikipedia-squads.json");
const REPORT_PATH = join(DATA_DIR, "sl-era-fill-report.json");

/** Year-card overrides: id → base player + season-specific fields. */
type CardOverride = {
  baseId: string;
  club: string;
  position: Position;
  rating?: number;
  nationality?: string;
  appearances?: number;
  tries?: number;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
  manOfSteel?: boolean;
  dreamTeamYears?: number[];
};

const CARD_OVERRIDES: Record<string, CardOverride> = {
  "catalans-hist-thomas-bosc-2008": { baseId: "thomas-bosc", club: "Catalans Dragons", position: "STAND_OFF", rating: 82 },
  "catalans-hist-stacey-jones-2008": { baseId: "catalans-hist-stacey-jones", club: "Catalans Dragons", position: "SCRUM_HALF", rating: 81 },
  "catalans-hist-gregory-mounis-2008": { baseId: "catalans-hist-gregory-mounis", club: "Catalans Dragons", position: "LOOSE_FORWARD", rating: 80 },

  "leeds-cur-zak-hardaker-2015": { baseId: "hull-fc-cur-zak-hardaker", club: "Leeds Rhinos", position: "FULLBACK", rating: 88, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-cur-ash-handley-2015": { baseId: "leeds-cur-ash-handley", club: "Leeds Rhinos", position: "WING", rating: 82, superLeagueWinner: true },
  "leeds-cur-tom-briscoe-2015": { baseId: "hull-fc-cur-tom-briscoe", club: "Leeds Rhinos", position: "WING", rating: 84, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-cur-kallum-watkins-2015": { baseId: "leeds-cur-kallum-watkins", club: "Leeds Rhinos", position: "CENTRE", rating: 90, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-joel-moon-2015": { baseId: "leeds-hist-joel-moon", club: "Leeds Rhinos", position: "CENTRE", rating: 86, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-danny-mcguire-2015": { baseId: "danny-mcguire", club: "Leeds Rhinos", position: "STAND_OFF", rating: 91, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-rob-burrow-2015": { baseId: "rob-burrow", club: "Leeds Rhinos", position: "SCRUM_HALF", rating: 88, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-jamie-peacock-2015": { baseId: "jamie-peacock", club: "Leeds Rhinos", position: "PROP", rating: 90, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-kylie-leuluai-2015": { baseId: "kylie-leuluai", club: "Leeds Rhinos", position: "PROP", rating: 89, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-paul-aiton-2015": { baseId: "wakefield-hist-paul-aiton", club: "Leeds Rhinos", position: "HOOKER", rating: 83, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-jamie-jones-buchanan-2015": { baseId: "jamie-jones-buchanan", club: "Leeds Rhinos", position: "SECOND_ROW", rating: 87, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-hist-brett-delaney-2015": { baseId: "leeds-hist-brett-delaney", club: "Leeds Rhinos", position: "SECOND_ROW", rating: 84, superLeagueWinner: true, challengeCupWinner: true },
  "leeds-leg-kevin-sinfield-2015": { baseId: "kevin-sinfield", club: "Leeds Rhinos", position: "LOOSE_FORWARD", rating: 93, superLeagueWinner: true, challengeCupWinner: true },

  "london-hist-alex-walker-2018": { baseId: "london-hist-alex-walker", club: "London Broncos", position: "FULLBACK", rating: 78 },
  "london-hist-rhys-williams-2018": { baseId: "salford-hist-rhys-williams", club: "London Broncos", position: "WING", rating: 77 },
  "london-hist-kieran-dixon-2018": { baseId: "london-hist-kieran-dixon", club: "London Broncos", position: "WING", rating: 79 },
  "london-hist-ben-hellewell-2018": { baseId: "salford-cur-ben-hellewell", club: "London Broncos", position: "CENTRE", rating: 80 },
  "london-hist-elliot-kear-2018": { baseId: "bradford-hist-elliot-kear", club: "London Broncos", position: "CENTRE", rating: 79 },
  "london-hist-jarrod-sammut-2018": { baseId: "bradford-hist-jarrod-sammut", club: "London Broncos", position: "SCRUM_HALF", rating: 81 },
  "london-hist-eddie-battye-2018": { baseId: "wakefield-hist-eddie-battye", club: "London Broncos", position: "PROP", rating: 78 },
  "london-hist-mark-ioane-2018": { baseId: "london-hist-mark-ioane", club: "London Broncos", position: "PROP", rating: 79 },
  "london-hist-eloi-pelissier-2018": { baseId: "catalans-hist-eloi-pelissier", club: "London Broncos", position: "HOOKER", rating: 77 },
  "london-hist-jay-pitts-2018": { baseId: "wakefield-cur-jay-pitts", club: "London Broncos", position: "SECOND_ROW", rating: 80 },
  "london-hist-will-lovell-2018": { baseId: "london-hist-will-lovell", club: "London Broncos", position: "SECOND_ROW", rating: 78 },
  "london-hist-sadiq-adebiyi-2018": { baseId: "london-hist-sadiq-adebiyi", club: "London Broncos", position: "LOOSE_FORWARD", rating: 79 },

  "salford-hist-niall-evalds-2015": { baseId: "huddersfield-cur-niall-evalds", club: "Salford Red Devils", position: "FULLBACK", rating: 80 },
  "salford-hist-ben-jones-bishop-2015": { baseId: "york-cur-ben-jones-bishop", club: "Salford Red Devils", position: "WING", rating: 82 },
  "salford-hist-greg-johnson-2015": { baseId: "salford-hist-greg-johnson", club: "Salford Red Devils", position: "WING", rating: 79 },
  "salford-hist-oliver-gildart-2015": { baseId: "hull-kr-cur-oliver-gildart", club: "Salford Red Devils", position: "CENTRE", rating: 78 },
  "salford-hist-iain-thornley-2015": { baseId: "wigan-hist-iain-thornley", club: "Salford Red Devils", position: "CENTRE", rating: 79 },
  "salford-hist-rangi-chase-2015": { baseId: "rangi-chase", club: "Salford Red Devils", position: "STAND_OFF", rating: 84 },
  "salford-hist-josh-wood-2015": { baseId: "salford-hist-josh-wood", club: "Salford Red Devils", position: "SCRUM_HALF", rating: 78 },
  "salford-hist-olsi-krasniqi-2015": { baseId: "london-hist-olsi-krasniqi", club: "Salford Red Devils", position: "PROP", rating: 80 },
  "salford-hist-adrian-morley-2015": { baseId: "adrian-morley", club: "Salford Red Devils", position: "PROP", rating: 86 },
  "salford-hist-liam-hood-2015": { baseId: "castleford-cur-liam-hood", club: "Salford Red Devils", position: "HOOKER", rating: 79 },
  "salford-hist-jake-bibby-2015": { baseId: "huddersfield-cur-jake-bibby", club: "Salford Red Devils", position: "SECOND_ROW", rating: 78 },
  "salford-hist-reni-maitua-2015": { baseId: "salford-hist-reni-maitua", club: "Salford Red Devils", position: "SECOND_ROW", rating: 82 },
  "salford-hist-james-greenwood-2015": { baseId: "hull-kr-hist-james-greenwood", club: "Salford Red Devils", position: "LOOSE_FORWARD", rating: 80 },

  "wakefield-hist-matt-blaymire-2009": { baseId: "wakefield-hist-matt-blaymire", club: "Wakefield Trinity", position: "FULLBACK", rating: 79 },
  "wakefield-hist-luke-george-2009": { baseId: "wakefield-hist-luke-george", club: "Wakefield Trinity", position: "WING", rating: 78 },
  "wakefield-hist-damien-blanch-2009": { baseId: "wakefield-hist-damien-blanch", club: "Wakefield Trinity", position: "WING", rating: 80 },
  "wakefield-hist-aaron-murphy-2009": { baseId: "huddersfield-leg-aaron-murphy", club: "Wakefield Trinity", position: "CENTRE", rating: 81 },
  "wakefield-hist-ryan-atkins-2009": { baseId: "warrington-hist-ryan-atkins", club: "Wakefield Trinity", position: "CENTRE", rating: 82 },
  "wakefield-hist-jamie-rooney-2009": { baseId: "wakefield-hist-jamie-rooney", club: "Wakefield Trinity", position: "STAND_OFF", rating: 80 },
  "wakefield-hist-danny-brough-2009": { baseId: "danny-brough", club: "Wakefield Trinity", position: "SCRUM_HALF", rating: 84 },
  "wakefield-hist-danny-sculthorpe-2009": { baseId: "wigan-hist-danny-sculthorpe", club: "Wakefield Trinity", position: "PROP", rating: 81 },
  "wakefield-hist-ricky-bibey-2009": { baseId: "wakefield-hist-ricky-bibey", club: "Wakefield Trinity", position: "PROP", rating: 79 },
  "wakefield-hist-sam-obst-2009": { baseId: "wakefield-hist-sam-obst", club: "Wakefield Trinity", position: "HOOKER", rating: 80 },
  "wakefield-hist-steve-snitch-2009": { baseId: "wakefield-hist-steve-snitch", club: "Wakefield Trinity", position: "SECOND_ROW", rating: 78 },
  "wakefield-hist-oliver-wilkes-2009": { baseId: "wakefield-hist-oliver-wilkes", club: "Wakefield Trinity", position: "SECOND_ROW", rating: 83 },

  "wigan-hist-mark-calderwood-2006": { baseId: "leeds-leg-mark-calderwood", club: "Wigan Warriors", position: "WING", rating: 82 },
  "wigan-hist-brett-dallas-2006": { baseId: "wigan-hist-brett-dallas", club: "Wigan Warriors", position: "WING", rating: 80 },
  "wigan-hist-pat-richards-2006": { baseId: "pat-richards", club: "Wigan Warriors", position: "CENTRE", rating: 85 },
  "wigan-hist-sean-gleeson-2006": { baseId: "wakefield-hist-sean-gleeson", club: "Wigan Warriors", position: "CENTRE", rating: 79 },
  "wigan-hist-kevin-brown-2006": { baseId: "kevin-brown", club: "Wigan Warriors", position: "STAND_OFF", rating: 81 },
  "wigan-hist-dennis-moran-2006": { baseId: "london-hist-dennis-moran", club: "Wigan Warriors", position: "SCRUM_HALF", rating: 80 },
  "wigan-hist-stuart-fielden-2006": { baseId: "stuart-fielden", club: "Wigan Warriors", position: "PROP", rating: 87 },
  "wigan-hist-scott-logan-2006": { baseId: "hull-fc-hist-scott-logan", club: "Wigan Warriors", position: "PROP", rating: 80 },
  "wigan-hist-michael-mcilorum-2006": { baseId: "wigan-hist-michael-mcilorum", club: "Wigan Warriors", position: "HOOKER", rating: 78 },
  "wigan-hist-mickey-higham-2006": { baseId: "warrington-hist-mickey-higham", club: "Wigan Warriors", position: "SECOND_ROW", rating: 84 },
  "wigan-hist-gareth-hock-2006": { baseId: "salford-hist-gareth-hock", club: "Wigan Warriors", position: "SECOND_ROW", rating: 82 },
  "wigan-hist-sean-oloughlin-2006": { baseId: "sean-oloughlin", club: "Wigan Warriors", position: "LOOSE_FORWARD", rating: 90 },

  "wigan-hist-richie-mathers-2008": { baseId: "leeds-hist-richard-mathers", club: "Wigan Warriors", position: "FULLBACK", rating: 82 },
  "wigan-hist-pat-richards-2008": { baseId: "pat-richards", club: "Wigan Warriors", position: "WING", rating: 86 },
  "wigan-hist-trent-barrett-2008": { baseId: "wigan-hist-trent-barrett", club: "Wigan Warriors", position: "WING", rating: 83 },
  "wigan-hist-karl-pryce-2008": { baseId: "bradford-hist-karl-pryce", club: "Wigan Warriors", position: "CENTRE", rating: 80 },
  "wigan-hist-cameron-phelps-2008": { baseId: "widnes-hist-cameron-phelps", club: "Wigan Warriors", position: "CENTRE", rating: 79 },
  "wigan-hist-sam-tomkins-2008": { baseId: "wigan-hist-sam-tomkins", club: "Wigan Warriors", position: "STAND_OFF", rating: 78 },
  "wigan-hist-thomas-leuluai-2008": { baseId: "wigan-hist-thomas-leuluai", club: "Wigan Warriors", position: "SCRUM_HALF", rating: 85 },
  "wigan-hist-stuart-fielden-2008": { baseId: "stuart-fielden", club: "Wigan Warriors", position: "PROP", rating: 86 },
  "wigan-hist-lee-mossop-2008": { baseId: "wigan-hist-lee-mossop", club: "Wigan Warriors", position: "PROP", rating: 79 },
  "wigan-hist-michael-mcilorum-2008": { baseId: "wigan-hist-michael-mcilorum", club: "Wigan Warriors", position: "HOOKER", rating: 80 },
  "wigan-hist-joel-tomkins-2008": { baseId: "wigan-hist-joel-tomkins", club: "Wigan Warriors", position: "SECOND_ROW", rating: 81 },
  "wigan-hist-gareth-hock-2008": { baseId: "salford-hist-gareth-hock", club: "Wigan Warriors", position: "SECOND_ROW", rating: 83 },
  "wigan-hist-sean-oloughlin-2008": { baseId: "sean-oloughlin", club: "Wigan Warriors", position: "LOOSE_FORWARD", rating: 91 },

  "wigan-hist-kris-radlinski-2006": { baseId: "kris-radlinski", club: "Wigan Warriors", position: "FULLBACK", rating: 88 },
};

const NEW_PLAYERS: RawPlayer[] = [
  {
    id: "london-hist-api-pewhairangi-2018",
    name: "Api Pewhairangi",
    position: "STAND_OFF",
    club: "London Broncos",
    nationality: "New Zealand",
    era: "MODERN_ERA",
    yearsActive: "2018–2018",
    cardYear: 2018,
    category: "historic",
    peakRating: 80,
    rating: 80,
    value: 350000,
    appearances: 24,
    tries: 8,
    sourceUrl: "https://en.wikipedia.org/wiki/2018_London_Broncos_season",
  },
  {
    id: "wakefield-hist-matthew-petersen-2009",
    name: "Matthew Petersen",
    position: "LOOSE_FORWARD",
    club: "Wakefield Trinity",
    nationality: "Australia",
    era: "MODERN_ERA",
    yearsActive: "2009–2009",
    cardYear: 2009,
    category: "historic",
    peakRating: 77,
    rating: 77,
    value: 200000,
    appearances: 18,
    tries: 2,
    sourceUrl: "https://en.wikipedia.org/wiki/2009_Wakefield_Trinity_Wildcats_season",
  },
];

function loadAllPlayers(): Map<string, RawPlayer> {
  const map = new Map<string, RawPlayer>();
  for (const p of [
    ...(currentSquads as RawPlayer[]),
    ...(historicPlayers as RawPlayer[]),
    ...(legends as RawPlayer[]),
  ]) {
    map.set(p.id, p);
  }
  return map;
}

function buildYearCard(id: string, override: CardOverride, base: RawPlayer): RawPlayer {
  const yearMatch = id.match(/-(\d{4})$/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  if (!year) throw new Error(`Year card id must end with -YYYY: ${id}`);

  const rating = override.rating ?? (base.peakRating as number) ?? (base.rating as number) ?? 80;
  const category =
    base.category === "legend" ? "historic" : ((base.category as string) ?? "historic");

  const card: RawPlayer = {
    ...base,
    id,
    club: override.club,
    position: override.position,
    yearsActive: `${year}–${year}`,
    cardYear: year,
    category,
    peakRating: rating,
    rating,
    value: Math.round(rating * rating * 500),
    era: "MODERN_ERA",
  };

  if (override.nationality) card.nationality = override.nationality;
  if (override.appearances !== undefined) card.appearances = override.appearances;
  if (override.tries !== undefined) card.tries = override.tries;
  if (override.superLeagueWinner) card.superLeagueWinner = true;
  if (override.challengeCupWinner) card.challengeCupWinner = true;
  if (override.manOfSteel) card.manOfSteel = true;
  if (override.dreamTeamYears) card.dreamTeamYears = override.dreamTeamYears;

  delete card.clubLegend;
  delete card.hallOfFame;

  return card;
}

function main(): void {
  const allPlayers = loadAllPlayers();
  const squads = verifiedSquads as VerifiedSquads;
  const additions = JSON.parse(readFileSync(ADDITIONS_PATH, "utf-8")) as {
    current: RawPlayer[];
    historic: RawPlayer[];
    legend: RawPlayer[];
  };
  if (!additions.historic) additions.historic = [];

  const existingIds = new Set([
    ...additions.historic.map((p) => p.id),
    ...additions.current.map((p) => p.id),
    ...(additions.legend ?? []).map((p) => p.id),
    ...allPlayers.keys(),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    teamsCompleted: [] as string[],
    playersAdded: [] as string[],
    playersUpdated: [] as string[],
    positionsCorrected: [] as string[],
    teamsSkippedNotSuperLeague: ["Bradford Bulls 2018", "Bradford Bulls 2020"],
    teamsStillIncomplete: [] as string[],
    sourcesUsed: [] as string[],
  };

  const neededIds = new Set<string>();
  for (const [club, years] of Object.entries(squads)) {
    for (const [year, entry] of Object.entries(years)) {
      for (const id of entry.playerIds) neededIds.add(id);
      report.sourcesUsed.push(`${club} ${year}: ${entry.source}`);
    }
  }

  for (const player of NEW_PLAYERS) {
    if (!existingIds.has(player.id)) {
      additions.historic.push(player);
      existingIds.add(player.id);
      allPlayers.set(player.id, player);
      report.playersAdded.push(player.id);
    }
  }

  for (const id of neededIds) {
    if (existingIds.has(id)) continue;
    const override = CARD_OVERRIDES[id];
    if (!override) {
      report.teamsStillIncomplete.push(`Missing card definition for ${id}`);
      continue;
    }
    const base = allPlayers.get(override.baseId);
    if (!base) {
      report.teamsStillIncomplete.push(`Missing base player ${override.baseId} for ${id}`);
      continue;
    }
    const card = buildYearCard(id, override, base);
    additions.historic.push(card);
    existingIds.add(id);
    allPlayers.set(id, card);
    report.playersAdded.push(id);
    if (override.position !== base.position) {
      report.positionsCorrected.push(`${id}: ${String(base.position)} → ${override.position}`);
    }
  }

  writeFileSync(ADDITIONS_PATH, `${JSON.stringify(additions, null, 2)}\n`);

  const eraStore = existsSync(ERA_SQUADS_PATH)
    ? (JSON.parse(readFileSync(ERA_SQUADS_PATH, "utf-8")) as Record<string, Record<string, unknown>>)
    : {};

  for (const [club, years] of Object.entries(squads)) {
    if (!eraStore[club]) eraStore[club] = {};
    for (const [year, entry] of Object.entries(years)) {
      const missing = entry.playerIds.filter((id) => !allPlayers.has(id) && !existingIds.has(id));
      if (missing.length > 0) {
        report.teamsStillIncomplete.push(`${club} ${year}: missing ids ${missing.join(", ")}`);
        continue;
      }
      eraStore[club][year] = {
        playerIds: entry.playerIds,
        positions: entry.positions,
        source: entry.source,
        wikipediaPlayers: entry.wikipediaPlayers,
        verifiedAt: new Date().toISOString().slice(0, 10),
      };
      report.teamsCompleted.push(`${club} ${year}`);
    }
  }

  writeFileSync(ERA_SQUADS_PATH, `${JSON.stringify(eraStore, null, 2)}\n`);
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Added ${report.playersAdded.length} year-specific / new players`);
  console.log(`Completed ${report.teamsCompleted.length} verified Super League squads`);
  console.log(`Skipped (not Super League): ${report.teamsSkippedNotSuperLeague.join(", ")}`);
  if (report.teamsStillIncomplete.length) {
    console.log(`Incomplete: ${report.teamsStillIncomplete.length}`);
    for (const line of report.teamsStillIncomplete) console.log(`  - ${line}`);
  }
  console.log(`Report: ${REPORT_PATH}`);
}

main();
