import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { getCurrentSquadPlayerIds } from "../players/era-teams";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { LeagueTransferActivity, ManagerCareer } from "./types";
import { getAskingPrice } from "./managerTransferLeague";

const MAX_TRANSFER_HISTORY = 24;
const TRANSFER_CHANCE_PER_MATCH = 0.14;

export function maybeGenerateAiTransfers(career: ManagerCareer): ManagerCareer {
  const rng = seedrandom(
    `${career.seed}-ai-transfer-w${career.gameWeek}-m${career.fixtures.length}`
  );
  if (rng() > TRANSFER_CHANCE_PER_MATCH) return career;

  const otherClubs = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== career.club);
  if (otherClubs.length < 2) return career;

  const fromClub = otherClubs[Math.floor(rng() * otherClubs.length)]!;
  const toCandidates = otherClubs.filter((c) => c !== fromClub);
  const toClub = toCandidates[Math.floor(rng() * toCandidates.length)]!;

  const listedFromClub = career.leagueListedPlayers.filter(
    (l) => l.club === fromClub
  );
  const roster = getCurrentSquadPlayerIds(fromClub);
  const pool =
    listedFromClub.length > 0
      ? listedFromClub.map((l) => l.playerId)
      : roster.filter((id) => {
          const p = getPlayerById(id);
          return p && (p.rating ?? p.peakRating) < 80;
        });

  if (pool.length === 0) return career;

  const playerId = pool[Math.floor(rng() * pool.length)]!;
  const player = getPlayerById(playerId);
  if (!player) return career;

  const listed = career.leagueListedPlayers.some((l) => l.playerId === playerId);
  const fee = Math.round(
    getAskingPrice(playerId, listed, career.seed, career.gameWeek) *
      (0.9 + rng() * 0.25)
  );

  const activity: LeagueTransferActivity = {
    id: `ai-tx-${career.gameWeek}-${playerId}-${Date.now()}`,
    week: career.gameWeek,
    fromClub,
    toClub,
    playerId,
    playerName: player.name,
    fee,
  };

  const leagueListedPlayers = career.leagueListedPlayers.filter(
    (l) => l.playerId !== playerId
  );

  return {
    ...career,
    leagueListedPlayers,
    leagueTransfers: [activity, ...(career.leagueTransfers ?? [])].slice(
      0,
      MAX_TRANSFER_HISTORY
    ),
  };
}
