import { POSITION_LABELS } from "../positions";
import type { Player } from "../types";

/** Canonical nationality → 3-letter uppercase abbreviation. */
const NATIONALITY_ABBREV: Record<string, string> = {
  England: "ENG",
  Australia: "AUS",
  "New Zealand": "NZL",
  France: "FRA",
  Ireland: "IRE",
  Scotland: "SCO",
  Wales: "WAL",
  Samoa: "SAM",
  Tonga: "TON",
  "Papua New Guinea": "PNG",
  Fiji: "FIJ",
  Lebanon: "LBN",
  Serbia: "SRB",
  "Cook Islands": "COK",
  Jamaica: "JAM",
  Italy: "ITA",
  Greece: "GRE",
};

const UNKNOWN_ABBREV = "UNK";

/** 3-letter uppercase nationality code. */
export function getNationalityAbbrev(nationality: string): string {
  const trimmed = nationality.trim();
  if (!trimmed || trimmed === "Unknown") return UNKNOWN_ABBREV;
  if (NATIONALITY_ABBREV[trimmed]) return NATIONALITY_ABBREV[trimmed];
  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  return compact.length >= 3 ? compact.slice(0, 3) : compact.padEnd(3, "X");
}

/** e.g. "ENG • Loose Forward" */
export function formatPlayerIdentity(player: Player): string {
  const abbrev = getNationalityAbbrev(player.nationality);
  const position = POSITION_LABELS[player.position];
  return `${abbrev} • ${position}`;
}
