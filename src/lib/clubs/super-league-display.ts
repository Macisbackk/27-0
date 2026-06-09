import clubsData from "../../../data/clubs.json";
import overridesData from "../../../data/player-super-league-club-overrides.json";
import legendsData from "../../../data/legends.json";

const clubs = clubsData as {
  name: string;
  active?: boolean;
}[];

const ACTIVE_CLUB_NAMES = new Set(
  clubs.filter((c) => c.active !== false).map((c) => c.name)
);

const PLAYER_OVERRIDES = overridesData as Record<string, string>;

const legendClubByName = new Map<string, string>(
  (legendsData as { name: string; club: string }[]).map((l) => [
    l.name,
    l.club,
  ])
);

/** Clubs that may appear in player cards, recruitment, and squad breakdowns. */
export function isActiveSuperLeagueClub(clubName: string): boolean {
  return ACTIVE_CLUB_NAMES.has(clubName);
}

export function getActiveSuperLeagueClubNames(): string[] {
  return Array.from(ACTIVE_CLUB_NAMES);
}

/**
 * Resolve a player's display club to an active Super League identity.
 * Raw JSON records are preserved; this only affects displayed/referenced clubs.
 */
export function resolveDisplayClub(
  playerId: string,
  rawClub: string,
  playerName: string
): string {
  if (isActiveSuperLeagueClub(rawClub)) {
    return rawClub;
  }

  const override = PLAYER_OVERRIDES[playerId];
  if (override && isActiveSuperLeagueClub(override)) {
    return override;
  }

  const legendClub = legendClubByName.get(playerName);
  if (legendClub && isActiveSuperLeagueClub(legendClub)) {
    return legendClub;
  }

  // Prefix fallbacks for championship-only historic entries
  if (playerId.startsWith("halifax-hist-")) return "Bradford Bulls";
  if (playerId.startsWith("oldham-hist-")) return "Wigan Warriors";
  if (playerId.startsWith("york-hist-")) return "York Knights";
  if (playerId.startsWith("sheffield-hist-")) return "Leeds Rhinos";
  if (playerId.startsWith("salford-hist-")) return "Leigh Leopards";
  if (playerId.startsWith("london-hist-")) return "Leeds Rhinos";
  if (playerId.startsWith("widnes-hist-")) return "Leigh Leopards";
  if (playerId.startsWith("toulouse-hist-")) return "Toulouse Olympique";
  if (playerId.startsWith("psg-hist-")) return "Catalans Dragons";
  if (playerId.startsWith("crusaders-hist-")) return "Leeds Rhinos";
  if (playerId.startsWith("gateshead-hist-")) return "Leeds Rhinos";

  return rawClub;
}
