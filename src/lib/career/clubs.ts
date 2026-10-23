import championshipClubsData from "../../../data/championship-clubs.json";
import clubsData from "../../../data/clubs.json";
import type { Division } from "./types";

export interface ClubSeed {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  /** Third kit colour (trim), so clubs sharing two colours still look different. */
  accent?: string;
  division: Division;
  /** Rough first-team level (≈ average rating of a generated XIII). */
  strength: number;
  /** Name used in data/current-squads.json `club`, when it has real players. */
  dataName: string;
}

type ClubJson = { id: string; name: string; shortName?: string; primaryColor?: string; secondaryColor?: string; accentColor?: string };
type ChampJson = ClubJson & { baseStrength?: number };

const COLOURS = new Map<string, ClubJson>();
for (const c of clubsData as ClubJson[]) COLOURS.set(c.name.toLowerCase(), c);

function colours(name: string, fallbackPrimary = "#1f2937", fallbackSecondary = "#ffffff") {
  const c = COLOURS.get(name.toLowerCase());
  return {
    primary: c?.primaryColor ?? fallbackPrimary,
    secondary: c?.secondaryColor ?? fallbackSecondary,
    accent: c?.accentColor,
  };
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The 14 clubs with real 2026 Super League squads in the 27-0 database. */
const SUPER_LEAGUE: Array<[name: string, short: string]> = [
  ["Leeds Rhinos", "LEE"],
  ["St Helens", "STH"],
  ["Wigan Warriors", "WIG"],
  ["Hull KR", "HKR"],
  ["Warrington Wolves", "WAR"],
  ["Wakefield Trinity", "WAK"],
  ["Catalans Dragons", "CAT"],
  ["Leigh Leopards", "LEI"],
  ["Hull FC", "HFC"],
  ["Huddersfield Giants", "HUD"],
  ["Bradford Bulls", "BRA"],
  ["Toulouse Olympique", "TOU"],
  ["Castleford Tigers", "CAS"],
  ["York Knights", "YOR"],
];

/** Championship clubs missing from data/championship-clubs.json (strengths from the old mode). */
const EXTRA_CHAMPIONSHIP: Array<{ name: string; short: string; strength: number }> = [
  { name: "London Broncos", short: "LON", strength: 72 },
  { name: "Widnes Vikings", short: "WID", strength: 71 },
  { name: "Halifax Panthers", short: "HAL", strength: 70 },
  { name: "Sheffield Eagles", short: "SHE", strength: 69 },
  { name: "Oldham RLFC", short: "OLD", strength: 68 },
];

/** Map championship-clubs.json baseStrength (54–74) onto the player rating scale (~70–79). */
function champRatingFromBase(base: number): number {
  return Math.round(70 + (base - 54) * 0.45);
}

export function buildClubSeeds(): ClubSeed[] {
  const seeds: ClubSeed[] = [];
  for (const [name, short] of SUPER_LEAGUE) {
    seeds.push({
      id: slug(name),
      name,
      short,
      ...colours(name),
      division: "super-league",
      strength: 82,
      dataName: name,
    });
  }
  for (const c of championshipClubsData as ChampJson[]) {
    seeds.push({
      id: slug(c.name),
      name: c.name,
      short: c.shortName ?? c.name.slice(0, 3).toUpperCase(),
      primary: c.primaryColor ?? colours(c.name).primary,
      secondary: c.secondaryColor ?? colours(c.name).secondary,
      accent: c.accentColor ?? colours(c.name).accent,
      division: "championship",
      strength: champRatingFromBase(c.baseStrength ?? 60),
      dataName: c.name,
    });
  }
  for (const c of EXTRA_CHAMPIONSHIP) {
    seeds.push({
      id: slug(c.name),
      name: c.name,
      short: c.short,
      ...colours(c.name),
      division: "championship",
      strength: champRatingFromBase(c.strength),
      dataName: c.name,
    });
  }
  return seeds;
}

export const DIVISION_LABEL: Record<Division, string> = {
  "super-league": "Super League",
  championship: "Championship",
};
