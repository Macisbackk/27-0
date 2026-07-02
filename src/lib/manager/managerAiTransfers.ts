import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { Position } from "../types";
import type { LeagueTransferActivity, ManagerCareer } from "./types";
import { getAskingPrice, getProtectedTransferPlayerIds } from "./managerTransferLeague";
import { getManagerPlayer } from "./managerPlayers";
import {
  getLeagueClubRosterIds,
  transferLeaguePlayer,
} from "./managerLeagueRosters";
import { RIVAL_CLUBS } from "./managerRivals";

const MAX_TRANSFER_HISTORY = 32;
const TRANSFER_CHANCE_PER_MATCH = 0.22;

function clubNeedsPosition(
  career: ManagerCareer,
  club: string,
  seed: string,
  week: number
): Position | null {
  const roster = getLeagueClubRosterIds(career, club);
  const counts: Partial<Record<Position, number>> = {};
  for (const id of roster) {
    const p = getManagerPlayer(career, id) ?? getPlayerById(id);
    if (!p) continue;
    counts[p.position] = (counts[p.position] ?? 0) + 1;
  }
  const needs: Position[] = [];
  if ((counts.PROP ?? 0) < 4) needs.push("PROP");
  if ((counts.HOOKER ?? 0) < 2) needs.push("HOOKER");
  if ((counts.WING ?? 0) < 3) needs.push("WING");
  if ((counts.SCRUM_HALF ?? 0) < 2) needs.push("SCRUM_HALF");
  if (needs.length === 0) return null;
  const rng = seedrandom(`${seed}-need-${club}-w${week}`);
  return needs[Math.floor(rng() * needs.length)] ?? null;
}

export function maybeGenerateAiTransfers(career: ManagerCareer): ManagerCareer {
  const rng = seedrandom(
    `${career.seed}-ai-transfer-w${career.gameWeek}-m${career.fixtures.length}`
  );
  if (rng() > TRANSFER_CHANCE_PER_MATCH) return career;

  const rivals = RIVAL_CLUBS[career.club] ?? [];
  const otherClubs = CURRENT_PLAYABLE_CLUBS.filter((c) => c !== career.club);
  if (otherClubs.length < 2) return career;

  const fromClub =
    rivals.length > 0 && rng() < 0.35
      ? rivals[Math.floor(rng() * rivals.length)]!
      : otherClubs[Math.floor(rng() * otherClubs.length)]!;

  const toCandidates = otherClubs.filter((c) => c !== fromClub);
  const need = clubNeedsPosition(
    career,
    toCandidates[Math.floor(rng() * toCandidates.length)]!,
    career.seed,
    career.gameWeek
  );
  const toClub =
    need !== null
      ? toCandidates.find(
          (c) =>
            clubNeedsPosition(career, c, career.seed, career.gameWeek) === need
        ) ?? toCandidates[Math.floor(rng() * toCandidates.length)]!
      : toCandidates[Math.floor(rng() * toCandidates.length)]!;

  const listedFromClub = career.leagueListedPlayers.filter(
    (l) => l.club === fromClub
  );
  const roster = getLeagueClubRosterIds(career, fromClub);
  const protectedIds = getProtectedTransferPlayerIds(career, fromClub);
  let pool =
    listedFromClub.length > 0
      ? listedFromClub
          .map((l) => l.playerId)
          .filter((id) => !protectedIds.has(id))
      : roster.filter((id) => !protectedIds.has(id));

  if (need) {
    const positional = pool.filter((id) => {
      const p = getManagerPlayer(career, id) ?? getPlayerById(id);
      return p?.position === need;
    });
    if (positional.length > 0) pool = positional;
  }

  if (pool.length === 0) return career;

  const playerId = pool[Math.floor(rng() * pool.length)]!;
  const player = getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
  if (!player) return career;

  const listed = career.leagueListedPlayers.some((l) => l.playerId === playerId);
  const fee = Math.round(
    getAskingPrice(playerId, listed, career.seed, career.gameWeek) *
      (0.88 + rng() * 0.3)
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

  const clubFunds = { ...career.clubFunds };
  clubFunds[fromClub] = Math.max(0, (clubFunds[fromClub] ?? 0) - fee);
  clubFunds[toClub] = (clubFunds[toClub] ?? 0) + fee;

  const withRoster = transferLeaguePlayer(
    {
      ...career,
      clubFunds,
      leagueListedPlayers,
      leagueTransfers: [activity, ...(career.leagueTransfers ?? [])].slice(
        0,
        MAX_TRANSFER_HISTORY
      ),
    },
    playerId,
    fromClub,
    toClub
  );

  return withRoster;
}
