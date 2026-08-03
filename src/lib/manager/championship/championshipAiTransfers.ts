import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../../clubs/super-league-display";
import { getChampionshipClubById } from "../../clubs/championship-clubs";
import type { LeagueTransferActivity, ManagerCareer } from "../types";
import { getLeagueClubRosterIds } from "../managerLeagueRosters";
import { getManagerPlayer } from "../managerPlayers";
import { getPlayerById } from "../../players";
import type { ChampionshipGeneratedPlayer } from "./championshipSquads";
import {
  championshipPlayerToPlayer,
  createChampionshipReplacementPlayer,
} from "./championshipSquads";

/** Target ~4–8 notable Champ→SL moves per full season. */
const WEEKLY_SCAN_CHANCE = 0.22;
const MAX_TRANSFERS_PER_SEASON = 8;
const MIN_ELITE_RATING = 76;
const INTEREST_COOLDOWN_WEEKS = 6;

const HEADLINE_PATTERNS = [
  (sl: string, ch: string, player: string) =>
    `${sl} move for ${ch} standout – ${player}`,
  (sl: string, _ch: string, player: string) =>
    `${player} earns Super League chance with ${sl}`,
  (sl: string, ch: string, _player: string) =>
    `${ch} lose star as ${sl} complete deal`,
  (sl: string, _ch: string, player: string) =>
    `${sl} gamble on Championship talent – ${player}`,
  (sl: string, ch: string, player: string) =>
    `${player} makes step up from ${ch} to ${sl}`,
];

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function eliteChampionshipPlayers(
  career: ManagerCareer
): ChampionshipGeneratedPlayer[] {
  const squads = career.championshipSquads;
  if (!squads) return [];
  return Object.values(squads.players).filter(
    (p) =>
      p.peakRating >= MIN_ELITE_RATING &&
      p.age >= 20 &&
      p.age <= 30 &&
      p.clubId !== "super-league" &&
      (career.championshipTransferCooldowns?.[p.id] ?? 0) <= career.gameWeek
  );
}

function clubNeedsPosition(
  career: ManagerCareer,
  club: string,
  position: ChampionshipGeneratedPlayer["position"]
): boolean {
  const roster = getLeagueClubRosterIds(career, club);
  let count = 0;
  for (const id of roster) {
    const p = getManagerPlayer(career, id) ?? getPlayerById(id);
    if (p?.position === position) count++;
  }
  const softCaps: Partial<Record<string, number>> = {
    PROP: 5,
    HOOKER: 3,
    WING: 4,
    SCRUM_HALF: 3,
    STAND_OFF: 3,
    CENTRE: 4,
    SECOND_ROW: 5,
    LOOSE_FORWARD: 3,
    FULLBACK: 3,
  };
  return count < (softCaps[position] ?? 4);
}

function topUpChampionshipRoster(
  career: ManagerCareer,
  clubId: string,
  rng: () => number
): ManagerCareer {
  const squads = career.championshipSquads;
  if (!squads) return career;
  const club = getChampionshipClubById(clubId);
  const clubName = club?.name ?? clubId;
  const replacement = createChampionshipReplacementPlayer(
    clubId,
    clubName,
    rng,
    squads.players,
    "PROP"
  );
  return {
    ...career,
    championshipSquads: {
      ...squads,
      rosterByClub: {
        ...squads.rosterByClub,
        [clubId]: [...(squads.rosterByClub[clubId] ?? []), replacement.id],
      },
      players: { ...squads.players, [replacement.id]: replacement },
    },
    playerRegistry: {
      ...career.playerRegistry,
      [replacement.id]: championshipPlayerToPlayer(replacement),
    },
  };
}

/**
 * Occasional AI Super League signing of elite Championship players.
 * Deterministic per week; most weeks no deal. ~4–8 per season.
 */
export function maybeAiSignChampionshipElite(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(
    `${career.seed}-champ-sl-tx-w${career.gameWeek}-s${career.seasonYear}`
  );
  const seasonCount = career.championshipToSlTransfersThisSeason ?? 0;
  if (seasonCount >= MAX_TRANSFERS_PER_SEASON) return career;
  if (rng() > WEEKLY_SCAN_CHANCE) return career;

  const elites = eliteChampionshipPlayers(career);
  if (elites.length === 0) return career;

  elites.sort((a, b) => b.peakRating - a.peakRating);
  const top = elites.slice(0, Math.min(8, elites.length));
  const player = top[Math.floor(rng() * top.length)]!;

  const buyers = shuffle(
    [...CURRENT_PLAYABLE_CLUBS].filter((c) => c !== career.club),
    rng
  );
  const buyer =
    buyers.find((club) => clubNeedsPosition(career, club, player.position)) ??
    (rng() < 0.15 ? buyers[0] : undefined);
  if (!buyer) {
    return {
      ...career,
      championshipTransferCooldowns: {
        ...(career.championshipTransferCooldowns ?? {}),
        [player.id]: career.gameWeek + INTEREST_COOLDOWN_WEEKS,
      },
    };
  }

  const fee = Math.round(
    80_000 + (player.peakRating - 76) * 35_000 + rng() * 40_000
  );
  const sellerClubId = player.clubId;
  const sellerName = player.clubName;

  let next: ManagerCareer = {
    ...career,
    playerRegistry: {
      ...career.playerRegistry,
      [player.id]: championshipPlayerToPlayer({
        ...player,
        clubName: buyer,
      }),
    },
  };

  const sellerRoster =
    next.championshipSquads?.rosterByClub[sellerClubId] ?? [];
  if (!sellerRoster.includes(player.id)) return career;

  const newRoster = sellerRoster.filter((id) => id !== player.id);
  const newPlayers = { ...next.championshipSquads!.players };
  newPlayers[player.id] = {
    ...player,
    clubId: "super-league",
    clubName: buyer,
  };

  next = {
    ...next,
    championshipSquads: {
      ...next.championshipSquads!,
      rosterByClub: {
        ...next.championshipSquads!.rosterByClub,
        [sellerClubId]: newRoster,
      },
      players: newPlayers,
    },
  };

  const buyerRoster = [
    ...getLeagueClubRosterIds(next, buyer).filter((id) => id !== player.id),
    player.id,
  ];
  next = {
    ...next,
    leagueClubRosters: {
      ...(next.leagueClubRosters ?? {}),
      [buyer]: buyerRoster,
    },
  };

  if (newRoster.length < 17) {
    next = topUpChampionshipRoster(next, sellerClubId, rng);
  }

  const transferId = `champ-sl-${career.seasonYear}-w${career.gameWeek}-${player.id}`;
  const headlineFn =
    HEADLINE_PATTERNS[Math.floor(rng() * HEADLINE_PATTERNS.length)]!;
  const headline = headlineFn(buyer, sellerName, player.name);
  const posLabel = player.position.replace(/_/g, " ").toLowerCase();
  const body = `${player.name} (${posLabel}, age ${player.age}, rating ${player.peakRating}) has joined ${buyer} from ${sellerName} in a deal worth £${Math.round(fee / 1000)}k.`;

  const activity: LeagueTransferActivity = {
    id: transferId,
    week: career.gameWeek,
    playerId: player.id,
    playerName: player.name,
    fromClub: sellerName,
    toClub: buyer,
    fee,
  };

  const newsItem = {
    id: `news-champ-sl-${transferId}`,
    week: career.gameWeek,
    type: "transfer" as const,
    text: `${headline}. ${body}`,
  };

  return {
    ...next,
    leagueTransfers: [activity, ...(next.leagueTransfers ?? [])].slice(0, 32),
    latestNews: [newsItem, ...(next.latestNews ?? [])].slice(0, 10),
    championshipToSlTransfersThisSeason: seasonCount + 1,
    championshipTransferCooldowns: {
      ...(next.championshipTransferCooldowns ?? {}),
      [player.id]: career.gameWeek + INTEREST_COOLDOWN_WEEKS,
    },
    aiChampionshipTransferVersion: 1,
  };
}
