import qldCupClubsData from "../../../data/qld-cup-clubs.json";
import type { Club } from "../clubs";

/**
 * Queensland Cup (and similar non-RFL) clubs — system metadata only.
 * Not playable, not manager-selectable, not in Super League / Championship pools.
 */
export interface QldCupClubRecord {
  id: string;
  name: string;
  shortName: string;
  nickname: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  league: "qld_cup";
  competition: string;
  active: boolean;
  playable: boolean;
  city?: string;
  stadium?: string;
  aliases?: string[];
}

export const QLD_CUP_CLUBS: QldCupClubRecord[] =
  qldCupClubsData as QldCupClubRecord[];

const BY_NAME = new Map<string, QldCupClubRecord>();
const BY_ID = new Map<string, QldCupClubRecord>();

for (const club of QLD_CUP_CLUBS) {
  BY_ID.set(club.id, club);
  BY_NAME.set(club.name.toLowerCase(), club);
  BY_NAME.set(club.shortName.toLowerCase(), club);
  BY_NAME.set(club.nickname.toLowerCase(), club);
  for (const alias of club.aliases ?? []) {
    BY_NAME.set(alias.toLowerCase(), club);
  }
}

export function getQldCupClubByName(name: string): QldCupClubRecord | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

export function getQldCupClubById(id: string): QldCupClubRecord | undefined {
  return BY_ID.get(id);
}

export function isQldCupClubName(name: string): boolean {
  return getQldCupClubByName(name) != null;
}

export function qldCupClubToClub(club: QldCupClubRecord): Club {
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    accentColor: club.accentColor,
    active: club.active,
    playable: false,
    isCurrentSuperLeague: false,
    league: "qld_cup",
  };
}

export function getAllQldCupClubsAsClub(): Club[] {
  return QLD_CUP_CLUBS.map(qldCupClubToClub);
}
