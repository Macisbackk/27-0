/**
 * Hall of Fame and Club Legend card tags come from two curated lists, not per-row flags,
 * so every card of a player agrees:
 *
 * - Hall of Fame: men's Rugby League Hall of Fame (RFL) inductee → data/hall-of-fame.json.
 *   Shown on every card of that player.
 * - Club Legend: club Hall of Fame inductee or recognised club great → data/club-legends.json.
 *   Shown only on that player's cards for the listed club(s).
 *
 * Players are matched on name (plus aliases), and on birth year when both sides have one,
 * so a later namesake is not tagged.
 */
import hallOfFameData from "../../../data/hall-of-fame.json";
import clubLegendsData from "../../../data/club-legends.json";

type HonourPerson = { name: string; aliases?: string[]; born?: number };
type ClubLegendEntry = HonourPerson & { clubs: string[] };

const BIRTH_YEAR_TOLERANCE = 1;

export function normalizeHonourName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function indexByName<T extends HonourPerson>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    for (const name of [entry.name, ...(entry.aliases ?? [])]) {
      const key = normalizeHonourName(name);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
  }
  return map;
}

const HALL_OF_FAME = indexByName(
  (hallOfFameData as { inductees: HonourPerson[] }).inductees
);
const CLUB_LEGENDS = indexByName(
  (clubLegendsData as { legends: ClubLegendEntry[] }).legends
);

function sameBirthYear(entry: HonourPerson, birthYear?: number): boolean {
  if (entry.born === undefined || birthYear === undefined) return true;
  return Math.abs(entry.born - birthYear) <= BIRTH_YEAR_TOLERANCE;
}

function findEntry<T extends HonourPerson>(
  index: Map<string, T[]>,
  name: string,
  birthYear?: number
): T | undefined {
  return index
    .get(normalizeHonourName(name))
    ?.find((entry) => sameBirthYear(entry, birthYear));
}

export function isHallOfFameInductee(name: string, birthYear?: number): boolean {
  return findEntry(HALL_OF_FAME, name, birthYear) !== undefined;
}

/** True when this card's club is one where the player is a recognised legend. */
export function isClubLegendAt(
  name: string,
  birthYear: number | undefined,
  clubs: Array<string | undefined>
): boolean {
  const entry = findEntry(CLUB_LEGENDS, name, birthYear);
  if (!entry) return false;
  return clubs.some((club) => club !== undefined && entry.clubs.includes(club));
}
