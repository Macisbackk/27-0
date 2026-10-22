import { getAllClubs } from "@/lib/clubs";
import type { Position } from "@/lib/types";
import type { GridCriterion, GridPlayer } from "./types";

/**
 * Header criteria. Only facts the player database records on every card:
 * club, nationality, position, season (era) and the honour lists that also
 * show on player cards.
 */

export type GridCriterionDef = GridCriterion & {
  test: (player: GridPlayer) => boolean;
};

/** A club needs this many players in the pool to be used as a header. */
const MIN_CLUB_PLAYERS = 20;
/** Attribute headers need this many players so they can cross enough clubs. */
const MIN_ATTRIBUTE_PLAYERS = 12;
/** An attribute that covers more than this share of the pool is too easy ("English"). */
const MAX_ATTRIBUTE_SHARE = 0.4;

const NATIONS: { key: string; label: string }[] = [
  { key: "australia", label: "Australia" },
  { key: "new zealand", label: "New Zealand" },
  { key: "wales", label: "Wales" },
  { key: "france", label: "France" },
  { key: "samoa", label: "Samoa" },
  { key: "tonga", label: "Tonga" },
  { key: "ireland", label: "Ireland" },
  { key: "scotland", label: "Scotland" },
  { key: "fiji", label: "Fiji" },
  { key: "papua new guinea", label: "PNG" },
  { key: "england", label: "England" },
];

const POSITIONS: Position[] = [
  "FULLBACK",
  "WING",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "HOOKER",
  "PROP",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

/** Header labels: short enough for a 60px column on a 320px phone. */
const POSITION_SHORT: Record<Position, string> = {
  FULLBACK: "Fullback",
  WING: "Winger",
  CENTRE: "Centre",
  STAND_OFF: "Stand-off",
  SCRUM_HALF: "Scrum-half",
  PROP: "Prop",
  HOOKER: "Hooker",
  SECOND_ROW: "Second row",
  LOOSE_FORWARD: "Loose forward",
};

const POSITION_NAME: Record<Position, string> = {
  FULLBACK: "Played fullback",
  WING: "Played on the wing",
  CENTRE: "Played centre",
  STAND_OFF: "Played stand-off",
  SCRUM_HALF: "Played scrum-half",
  PROP: "Played prop",
  HOOKER: "Played hooker",
  SECOND_ROW: "Played second row",
  LOOSE_FORWARD: "Played loose forward",
};

function allCandidateCriteria(): GridCriterionDef[] {
  const out: GridCriterionDef[] = [];

  for (const club of getAllClubs()) {
    out.push({
      id: `club:${club.id}`,
      kind: "club",
      label: club.shortName,
      name: club.name,
      clubName: club.name,
      test: (player) => player.clubIds.includes(club.id),
    });
  }

  for (const nation of NATIONS) {
    out.push({
      id: `nation:${nation.key.replace(/\s+/g, "-")}`,
      kind: "nation",
      label: nation.label,
      tag: "Nation",
      name: `Nationality: ${nation.label === "PNG" ? "Papua New Guinea" : nation.label}`,
      test: (player) => player.nationKeys.includes(nation.key),
    });
  }

  for (const position of POSITIONS) {
    out.push({
      id: `position:${position}`,
      kind: "position",
      label: POSITION_SHORT[position],
      tag: "Position",
      name: POSITION_NAME[position],
      test: (player) => player.positions.includes(position),
    });
  }

  out.push(
    {
      id: "era:pre-2000",
      kind: "era",
      label: "Pre-2000",
      tag: "Era",
      name: "Played before 2000",
      test: (player) => player.firstYear > 0 && player.firstYear < 2000,
    },
    {
      id: "era:current",
      kind: "era",
      label: "Current",
      tag: "Squad",
      name: "In a current Super League squad",
      test: (player) => player.current,
    },
    {
      id: "honour:sl-champion",
      kind: "honour",
      label: "SL champion",
      tag: "Honour",
      name: "Won Super League",
      test: (player) => player.superLeagueChampion,
    },
    {
      id: "honour:challenge-cup",
      kind: "honour",
      label: "Cup winner",
      tag: "Honour",
      name: "Won the Challenge Cup",
      test: (player) => player.challengeCupWinner,
    },
    {
      id: "honour:dream-team",
      kind: "honour",
      label: "Dream Team",
      tag: "Honour",
      name: "Named in a Super League Dream Team",
      test: (player) => player.dreamTeam,
    }
  );

  return out;
}

/** Fixed-size bitset over pool indices (fast pair counts for the generator). */
export type GridBitset = Uint32Array;

function popcount32(value: number): number {
  let v = value - ((value >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function bitsetCount(bits: GridBitset): number {
  let total = 0;
  for (let i = 0; i < bits.length; i++) total += popcount32(bits[i] ?? 0);
  return total;
}

export function bitsetAndCount(a: GridBitset, b: GridBitset): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += popcount32((a[i] ?? 0) & (b[i] ?? 0));
  return total;
}

export type GridCatalogue = {
  players: readonly GridPlayer[];
  criteria: GridCriterionDef[];
  byId: Map<string, GridCriterionDef>;
  bits: Map<string, GridBitset>;
};

export function buildGridCatalogue(players: readonly GridPlayer[]): GridCatalogue {
  const words = Math.ceil(players.length / 32) || 1;
  const criteria: GridCriterionDef[] = [];
  const bits = new Map<string, GridBitset>();

  for (const def of allCandidateCriteria()) {
    const set = new Uint32Array(words);
    let count = 0;
    players.forEach((player, index) => {
      if (!def.test(player)) return;
      set[index >>> 5] = (set[index >>> 5] ?? 0) | (1 << (index & 31));
      count += 1;
    });
    if (def.kind === "club") {
      if (count < MIN_CLUB_PLAYERS) continue;
    } else if (
      count < MIN_ATTRIBUTE_PLAYERS ||
      count > players.length * MAX_ATTRIBUTE_SHARE
    ) {
      continue;
    }
    criteria.push(def);
    bits.set(def.id, set);
  }

  return {
    players,
    criteria,
    byId: new Map(criteria.map((def) => [def.id, def])),
    bits,
  };
}
