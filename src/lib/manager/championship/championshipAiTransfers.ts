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
import { DEFAULT_TRANSFER_ACTIVITY_CONFIG } from "../transferActivityConfig";

/** Normal interest floor on the Championship 70–89 scale. */
const MIN_INTEREST_RATING = 81;
/** Strong interest / preferred targets. */
const STRONG_INTEREST_RATING = 84;
/** Elite targets (usually 85–89). */
const MIN_ELITE_RATING = 85;

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
  return Object.values(squads.players).filter((p) => {
    if (p.clubId === "super-league") return false;
    if (p.age < 19 || p.age > 30) return false;
    if ((career.championshipTransferCooldowns?.[p.id] ?? 0) > career.gameWeek) {
      return false;
    }
    // Exceptional younger prospects can attract interest slightly below 81.
    const youngProspect =
      p.age <= 22 && p.peakRating >= 79 && p.peakRating < MIN_INTEREST_RATING;
    return p.peakRating >= MIN_INTEREST_RATING || youngProspect;
  });
}

function transferInterestWeight(player: ChampionshipGeneratedPlayer): number {
  let w = 1;
  if (player.peakRating >= MIN_ELITE_RATING) w += 3;
  else if (player.peakRating >= STRONG_INTEREST_RATING) w += 2;
  else if (player.peakRating >= MIN_INTEREST_RATING) w += 1;
  if (player.age <= 23) w += 0.75;
  if (player.age >= 28) w -= 0.35;
  if (player.form >= 60) w += 0.35;
  return Math.max(0.15, w);
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
  const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG.championshipEliteToSl;
  const heat = DEFAULT_TRANSFER_ACTIVITY_CONFIG.gameWeekActivityMultiplier(
    career.gameWeek
  );
  const rng = seedrandom(
    `${career.seed}-champ-sl-tx-w${career.gameWeek}-s${career.seasonYear}`
  );
  const seasonCount = career.championshipToSlTransfersThisSeason ?? 0;
  if (seasonCount >= cfg.maxTransfersPerSeason) return career;
  if (rng() > Math.min(0.9, cfg.weeklyScanChance * heat)) return career;

  const elites = eliteChampionshipPlayers(career);
  if (elites.length === 0) return career;

  // Prefer stronger / younger targets; do not auto-sign every 80+.
  const weighted = elites.flatMap((p) => {
    const copies = Math.max(1, Math.round(transferInterestWeight(p) * 2));
    return Array.from({ length: copies }, () => p);
  });
  const player = weighted[Math.floor(rng() * weighted.length)]!;

  // Soft reject: normal-interest (81–83) less often unless squad need is acute.
  if (
    player.peakRating < STRONG_INTEREST_RATING &&
    rng() > 0.45
  ) {
    return {
      ...career,
      championshipTransferCooldowns: {
        ...(career.championshipTransferCooldowns ?? {}),
        [player.id]: career.gameWeek + cfg.cooldownWeeks,
      },
    };
  }

  const buyers = shuffle(
    [...CURRENT_PLAYABLE_CLUBS].filter((c) => c !== career.club),
    rng
  );
  const buyer =
    buyers.find((club) => clubNeedsPosition(career, club, player.position)) ??
    (player.peakRating >= MIN_ELITE_RATING && rng() < 0.2
      ? buyers[0]
      : undefined);
  if (!buyer) {
    return {
      ...career,
      championshipTransferCooldowns: {
        ...(career.championshipTransferCooldowns ?? {}),
        [player.id]: career.gameWeek + cfg.cooldownWeeks,
      },
    };
  }

  const fee = Math.round(
    55_000 +
      Math.max(0, player.peakRating - 70) * 14_000 +
      (player.peakRating >= STRONG_INTEREST_RATING ? 25_000 : 0) +
      rng() * 35_000
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
    fromCompetitionId: "championship",
    toCompetitionId: "super-league",
    transferType: "permanent",
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
      [player.id]: career.gameWeek + cfg.cooldownWeeks,
    },
    aiChampionshipTransferVersion: 1,
  };
}
