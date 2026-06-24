/**
 * Fix Era Mode regression after player year-card migration.
 * Run: npx tsx scripts/apply-era-regression-fixes.ts
 * Then: npm run build:team-year-rosters
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import migrationReport from "../data/player-year-card-migration-report.json";
import playerAdditions from "../data/player-additions.json";
import type { Position } from "../src/lib/types";

type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  peakRating: number;
  rating?: number;
  yearsActive?: string;
  category?: string;
  nationality?: string;
  basePlayerId?: string;
};

type WikiSquadEntry = {
  playerIds: string[];
  positions?: string[];
  wikipediaPlayers?: string[];
};

const DATA = join(process.cwd(), "data");

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildTeamYearId(club: string, year: number): string {
  return `${club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}-${year}`;
}

function clubPrefix(club: string): string {
  const map: Record<string, string> = {
    "Bradford Bulls": "bradford",
    "Leeds Rhinos": "leeds",
    "Wigan Warriors": "wigan",
    "London Broncos": "london",
    "Toulouse Olympique": "toulouse",
  };
  return map[club] ?? slug(club);
}

function categorySegment(category: string): string {
  if (category === "current") return "cur";
  if (category === "legend") return "leg";
  return "hist";
}

function buildYearCardId(
  club: string,
  name: string,
  year: number,
  category: string
): string {
  return `${clubPrefix(club)}-${categorySegment(category)}-${slug(name)}-${year}`;
}

function makeYearCard(
  id: string,
  base: RawPlayer,
  club: string,
  year: number,
  position?: string
): RawPlayer {
  const rating = Math.max(75, base.peakRating ?? (base.rating as number) ?? 80);
  const pos = position ?? base.position;
  return {
    ...base,
    id,
    name: base.name,
    club,
    team: club,
    displayClub: club,
    position: pos,
    yearsActive: `${year}–${year}`,
    cardYear: year,
    year,
    teamYearId: buildTeamYearId(club, year),
    basePlayerId: base.basePlayerId ?? base.id,
    status: "Historic",
    category: "historic",
    peakRating: rating,
    rating,
    value: Math.round(rating * rating * 500),
    primaryPosition: (base.primaryPosition as string | undefined) ?? pos,
    availableInGame: true,
  };
}

function makeBaseHistoric(spec: {
  id: string;
  name: string;
  club: string;
  position: string;
  peakRating: number;
  yearsActive: string;
  nationality?: string;
}): RawPlayer {
  return {
    id: spec.id,
    name: spec.name,
    club: spec.club,
    position: spec.position,
    category: "historic",
    peakRating: spec.peakRating,
    rating: spec.peakRating,
    yearsActive: spec.yearsActive,
    nationality: spec.nationality ?? "England",
    era: "MODERN_ERA",
    value: Math.round(spec.peakRating * spec.peakRating * 500),
    availableInGame: true,
  };
}

function loadPlayerMap(): Map<string, RawPlayer> {
  const additions = playerAdditions as {
    current?: RawPlayer[];
    historic?: RawPlayer[];
    legend?: RawPlayer[];
  };
  const historic = JSON.parse(
    readFileSync(join(DATA, "historic-players.json"), "utf-8")
  ) as RawPlayer[];
  const legends = JSON.parse(
    readFileSync(join(DATA, "legends.json"), "utf-8")
  ) as RawPlayer[];
  const map = new Map<string, RawPlayer>();
  for (const p of [
    ...(currentSquads as RawPlayer[]),
    ...historic,
    ...legends,
    ...(additions.current ?? []),
    ...(additions.historic ?? []),
    ...(additions.legend ?? []),
  ]) {
    map.set(p.id, p);
  }
  return map;
}

function resolveBasePlayer(
  fromId: string,
  byId: Map<string, RawPlayer>
): RawPlayer | undefined {
  if (byId.has(fromId)) return byId.get(fromId);
  const alias = TOULOUSE_BASE_ID_ALIASES[fromId] ?? BASE_ID_ALIASES[fromId];
  return alias ? byId.get(alias) : undefined;
}

const BASE_ID_ALIASES: Record<string, string> = {
  "hull-fc-cur-morgan-smith": "hull-fc-hist-era-morgan-smith",
  "castleford-cur-brad-singleton": "leeds-hist-era-brad-singleton",
};

const TOULOUSE_BASE_ID_ALIASES: Record<string, string> = {
  "toulouse-cur-joe-bretherton": "toulouse-hist-era-joe-bretherton",
  "toulouse-cur-joe-cator": "hull-fc-hist-era-joe-cator",
};

const TOULOUSE_MISSING_BASES: RawPlayer[] = [
  makeBaseHistoric({
    id: "toulouse-hist-luke-polselli",
    name: "Luke Polselli",
    club: "Toulouse Olympique",
    position: "STAND_OFF",
    peakRating: 76,
    yearsActive: "2022–Present",
    nationality: "Australia",
  }),
  makeBaseHistoric({
    id: "toulouse-hist-henry-o-kane",
    name: "Henry O'Kane",
    club: "Toulouse Olympique",
    position: "SECOND_ROW",
    peakRating: 76,
    yearsActive: "2022–Present",
    nationality: "Australia",
  }),
];

const LONDON_2019_REPLACEMENTS: Record<string, string> = {
  "london-hist-alex-walker": "london-hist-alex-walker-2019",
  "salford-hist-rhys-williams": "london-hist-rhys-williams-2019",
  "london-hist-kieran-dixon": "london-hist-kieran-dixon-2019",
  "st-helens-hist-ryan-morgan": "london-hist-ryan-morgan-2019",
  "salford-cur-ben-hellewell": "london-hist-ben-hellewell-2019",
  "hull-fc-hist-jordan-abdull": "london-hist-jordan-abdull-2019",
  "hull-fc-cur-morgan-smith": "london-hist-morgan-smith-2019",
  "hull-fc-hist-era-morgan-smith": "london-hist-morgan-smith-2019",
  "wakefield-hist-eddie-battye": "london-hist-eddie-battye-2019",
  "st-helens-hist-greg-richards": "london-hist-greg-richards-2019",
  "catalans-hist-eloi-pelissier": "london-hist-eloi-pelissier-2019",
  "wakefield-cur-jay-pitts": "london-hist-jay-pitts-2019",
  "london-hist-will-lovell": "london-hist-will-lovell-2019",
  "warrington-cur-luke-yates": "london-hist-luke-yates-2019",
};

const LONDON_2019_POSITIONS: Record<string, Position> = {
  "london-hist-alex-walker-2019": "FULLBACK",
  "london-hist-rhys-williams-2019": "WING",
  "london-hist-kieran-dixon-2019": "WING",
  "london-hist-ryan-morgan-2019": "CENTRE",
  "london-hist-ben-hellewell-2019": "CENTRE",
  "london-hist-jordan-abdull-2019": "STAND_OFF",
  "london-hist-morgan-smith-2019": "SCRUM_HALF",
  "london-hist-eddie-battye-2019": "PROP",
  "london-hist-greg-richards-2019": "PROP",
  "london-hist-eloi-pelissier-2019": "HOOKER",
  "london-hist-jay-pitts-2019": "SECOND_ROW",
  "london-hist-will-lovell-2019": "SECOND_ROW",
  "london-hist-luke-yates-2019": "LOOSE_FORWARD",
};

const LEEDS_2016_REPLACEMENTS: Record<string, string> = {
  "leeds-hist-jimmy-keinhorst": "leeds-hist-jimmy-keinhorst-2016",
  "danny-mcguire": "leeds-leg-danny-mcguire-2016",
  "rob-burrow": "leeds-leg-rob-burrow-2016",
  "castleford-cur-brad-singleton": "leeds-hist-brad-singleton-2016",
  "leeds-hist-era-brad-singleton": "leeds-hist-brad-singleton-2016",
  "leeds-hist-mitch-garbutt": "leeds-hist-mitch-garbutt-2016",
  "jamie-jones-buchanan": "leeds-leg-jamie-jones-buchanan-2016",
};

const LEEDS_2016_POSITIONS: Record<string, Position> = {
  "leeds-hist-jimmy-keinhorst-2016": "CENTRE",
  "leeds-leg-danny-mcguire-2016": "STAND_OFF",
  "leeds-leg-rob-burrow-2016": "SCRUM_HALF",
  "leeds-hist-brad-singleton-2016": "PROP",
  "leeds-hist-mitch-garbutt-2016": "HOOKER",
  "leeds-leg-jamie-jones-buchanan-2016": "SECOND_ROW",
};

const WIGAN_2008_REPLACEMENTS: Record<string, string> = {
  "wigan-hist-joel-tomkins": "wigan-hist-joel-tomkins-2008",
};

const WIGAN_2008_POSITIONS: Record<string, Position> = {
  "wigan-hist-joel-tomkins-2008": "SECOND_ROW",
};

const TOULOUSE_WIKI_ID_ALIASES: Record<string, string> = {
  "toulouse-cur-luke-polselli": "toulouse-hist-luke-polselli",
  "toulouse-cur-henry-o-kane": "toulouse-hist-henry-o-kane",
};

const CAREER_SPAN_ADDITIONS: Record<string, string[]> = {
  "huddersfield-hist-jeff-wittenberg": ["Bradford Bulls"],
  "hull-fc-hist-lee-radford": ["Bradford Bulls"],
  "wakefield-hist-paul-sykes": ["Bradford Bulls"],
  "jamie-peacock": ["Bradford Bulls", "Leeds Rhinos"],
  "leon-pryce": ["Bradford Bulls", "St Helens"],
  "paul-anderson": ["Bradford Bulls", "St Helens"],
  "stuart-fielden": ["Bradford Bulls", "Wigan Warriors"],
  "shaun-edwards": ["Bradford Bulls"],
  "tevita-vaikona": ["Bradford Bulls"],
  "lesley-vainikolo": ["Bradford Bulls"],
  "huddersfield-hist-brandon-costin": ["Bradford Bulls"],
  "catalans-cur-tiaki-chan": ["Toulouse Olympique"],
  "hull-fc-hist-era-morgan-smith": ["London Broncos"],
  "hull-fc-hist-era-joe-cator": ["Toulouse Olympique"],
};

function ensureYearCardsForSquad(
  team: string,
  year: number,
  replacements: Record<string, string>,
  positions: Record<string, Position>,
  wikiEntry: WikiSquadEntry | undefined,
  historic: RawPlayer[],
  byId: Map<string, RawPlayer>,
  existingIds: Set<string>
): number {
  let added = 0;
  const seenTargets = new Set<string>();

  for (const [fromId, toId] of Object.entries(replacements)) {
    if (seenTargets.has(toId) || existingIds.has(toId)) continue;
    const base = resolveBasePlayer(fromId, byId);
    if (!base) continue;
    const position =
      positions[toId] ??
      wikiEntry?.positions?.[
        wikiEntry.playerIds.findIndex(
          (id) => id === fromId || replacements[id] === toId
        )
      ];
    const card = makeYearCard(toId, base, team, year, position);
    historic.push(card);
    byId.set(toId, card);
    existingIds.add(toId);
    seenTargets.add(toId);
    added++;
  }

  return added;
}

function ensureBradfordYearCards(
  wiki: Record<string, Record<string, WikiSquadEntry>>,
  historic: RawPlayer[],
  byId: Map<string, RawPlayer>,
  existingIds: Set<string>
): { cardsAdded: number; wikiUpdates: number } {
  let cardsAdded = 0;
  let wikiUpdates = 0;
  const years = [1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004];

  for (const year of years) {
    const entry = wiki["Bradford Bulls"]?.[String(year)];
    if (!entry?.playerIds) continue;

    const replacements: Record<string, string> = {};
    for (let i = 0; i < entry.playerIds.length; i++) {
      const fromId = entry.playerIds[i]!;
      if (/-\d{4}$/.test(fromId)) continue;

      const base = resolveBasePlayer(fromId, byId);
      if (!base) continue;

      const toId = buildYearCardId(
        "Bradford Bulls",
        base.name,
        year,
        base.category ?? "historic"
      );
      replacements[fromId] = toId;

      if (!existingIds.has(toId)) {
        const position = entry.positions?.[i] ?? base.position;
        const card = makeYearCard(
          toId,
          base,
          "Bradford Bulls",
          year,
          position
        );
        historic.push(card);
        byId.set(toId, card);
        existingIds.add(toId);
        cardsAdded++;
      }
    }

    entry.playerIds = entry.playerIds.map((id) => {
      const next = replacements[id];
      if (next) wikiUpdates++;
      return next ?? id;
    });
  }

  return { cardsAdded, wikiUpdates };
}

function ensureToulouseYearCards(
  wiki: Record<string, Record<string, WikiSquadEntry>>,
  historic: RawPlayer[],
  byId: Map<string, RawPlayer>,
  existingIds: Set<string>
): { cardsAdded: number; wikiUpdates: number } {
  let cardsAdded = 0;
  let wikiUpdates = 0;
  const years = [2022] as const;

  for (const addition of TOULOUSE_MISSING_BASES) {
    if (!byId.has(addition.id)) {
      byId.set(addition.id, addition);
    }
  }

  for (const y of years) {
    const entry = wiki["Toulouse Olympique"]?.[String(y)];
    if (!entry?.playerIds) continue;

    if (entry.wikipediaPlayers) {
      entry.wikipediaPlayers = entry.wikipediaPlayers.map((name) =>
        name === "Henry OKane" ? "Henry O'Kane" : name
      );
    }

    const replacements: Record<string, string> = {};
    for (let i = 0; i < entry.playerIds.length; i++) {
      const fromId = entry.playerIds[i]!;
      const resolvedFromId = TOULOUSE_WIKI_ID_ALIASES[fromId] ?? fromId;
      const base = resolveBasePlayer(resolvedFromId, byId);
      if (!base) continue;

      const toId = `toulouse-hist-${slug(base.name)}-${y}`;
      replacements[fromId] = toId;

      if (!existingIds.has(toId)) {
        const position = entry.positions?.[i] ?? base.position;
        const card = makeYearCard(
          toId,
          base,
          "Toulouse Olympique",
          y,
          position
        );
        historic.push(card);
        byId.set(toId, card);
        existingIds.add(toId);
        cardsAdded++;
      }
    }

    entry.playerIds = entry.playerIds.map((id) => {
      const next = replacements[id];
      if (next) wikiUpdates++;
      return next ?? id;
    });
  }

  return { cardsAdded, wikiUpdates };
}

function patchWikiIds(
  wiki: Record<string, Record<string, WikiSquadEntry>>,
  team: string,
  year: string,
  replacements: Record<string, string>
): number {
  const entry = wiki[team]?.[year];
  if (!entry?.playerIds) return 0;
  let updates = 0;
  entry.playerIds = entry.playerIds.map((id) => {
    const next = replacements[id];
    if (next) updates++;
    return next ?? id;
  });
  return updates;
}

function main(): void {
  const byId = loadPlayerMap();
  const historic = JSON.parse(
    readFileSync(join(DATA, "historic-players.json"), "utf-8")
  ) as RawPlayer[];
  const existingIds = new Set(historic.map((p) => p.id));
  let cardsAdded = 0;
  let wikiUpdates = 0;

  cardsAdded += ensureYearCardsForSquad(
    "London Broncos",
    2019,
    LONDON_2019_REPLACEMENTS,
    LONDON_2019_POSITIONS,
    undefined,
    historic,
    byId,
    existingIds
  );

  const wiki = JSON.parse(
    readFileSync(join(DATA, "era-wikipedia-squads.json"), "utf-8")
  ) as Record<string, Record<string, WikiSquadEntry>>;

  wikiUpdates += patchWikiIds(wiki, "London Broncos", "2019", LONDON_2019_REPLACEMENTS);

  cardsAdded += ensureYearCardsForSquad(
    "Leeds Rhinos",
    2016,
    LEEDS_2016_REPLACEMENTS,
    LEEDS_2016_POSITIONS,
    undefined,
    historic,
    byId,
    existingIds
  );

  cardsAdded += ensureYearCardsForSquad(
    "Wigan Warriors",
    2008,
    WIGAN_2008_REPLACEMENTS,
    WIGAN_2008_POSITIONS,
    undefined,
    historic,
    byId,
    existingIds
  );

  wikiUpdates += patchWikiIds(wiki, "Leeds Rhinos", "2016", LEEDS_2016_REPLACEMENTS);
  wikiUpdates += patchWikiIds(wiki, "Wigan Warriors", "2008", WIGAN_2008_REPLACEMENTS);

  const bradford = ensureBradfordYearCards(wiki, historic, byId, existingIds);
  cardsAdded += bradford.cardsAdded;
  wikiUpdates += bradford.wikiUpdates;

  const toulouse = ensureToulouseYearCards(wiki, historic, byId, existingIds);
  cardsAdded += toulouse.cardsAdded;
  wikiUpdates += toulouse.wikiUpdates;

  const replacements = (
    migrationReport as {
      rosterReplacements: Array<{
        team: string;
        year: string;
        from: string;
        to: string;
      }>;
    }
  ).rosterReplacements;

  const targetBradfordYears = new Set([
    "1997",
    "1998",
    "1999",
    "2000",
    "2001",
    "2002",
    "2003",
    "2004",
  ]);

  for (const rep of replacements) {
    if (rep.team === "Bradford Bulls" && !targetBradfordYears.has(rep.year)) {
      continue;
    }
    const entry = wiki[rep.team]?.[rep.year];
    if (!entry?.playerIds) continue;
    entry.playerIds = entry.playerIds.map((id) => {
      if (id !== rep.from) return id;
      wikiUpdates++;
      return rep.to;
    });
  }

  writeFileSync(
    join(DATA, "historic-players.json"),
    `${JSON.stringify(historic, null, 2)}\n`
  );
  writeFileSync(
    join(DATA, "era-wikipedia-squads.json"),
    `${JSON.stringify(wiki, null, 2)}\n`
  );

  const spansPath = join(DATA, "club-career-spans.json");
  const spans = JSON.parse(readFileSync(spansPath, "utf-8")) as Record<
    string,
    string[]
  >;
  let spansAdded = 0;
  for (const [playerId, clubs] of Object.entries(CAREER_SPAN_ADDITIONS)) {
    const existing = new Set(spans[playerId] ?? []);
    for (const c of clubs) {
      if (!existing.has(c)) {
        existing.add(c);
        spansAdded++;
      }
    }
    spans[playerId] = [...existing];
  }
  writeFileSync(spansPath, `${JSON.stringify(spans, null, 2)}\n`);

  console.log(`Added ${cardsAdded} year cards`);
  console.log(`Updated ${wikiUpdates} era-wikipedia-squad player IDs`);
  console.log(`Added ${spansAdded} club-career-span links`);
  console.log("Run: npm run build:team-year-rosters");
}

main();
