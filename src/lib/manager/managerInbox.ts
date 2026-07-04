import {
  deriveCupOutcomeFromBracket,
  getCupRoundLabel,
} from "../game/challenge-cup-bracket";
import type { InboxMessage, ManagerCareer } from "./types";
import {
  getPendingCupBracketRound,
  getUserCupMatch,
  prepareCupRound,
} from "./managerChallengeCup";
import {
  computeManagerSeasonRewardLines,
  formatRewardTotal,
} from "./managerSeasonRewards";
import { buildSeasonSummary } from "./managerStateSeason";
import { getPlayerById } from "../players";
import {
  formatWage,
  getContractStatus,
  applyRenewal,
  ensureRenewalDemands,
  generateRenewalDemand,
  evaluateRenewalOffer,
} from "./managerContracts";
import { syncReserveContractExpiryInbox } from "./managerReserveContracts";
import { ensureRetirementIntent } from "./managerRetirement";
import { getUserLeaguePosition } from "./managerFixtures";
import { getManagerPlayer } from "./managerPlayers";

export function normalizeInboxMessage(
  raw: Partial<InboxMessage> & { id: string; title: string; body: string },
  career: ManagerCareer
): InboxMessage {
  const week = raw.week ?? raw.gameWeek ?? career.gameWeek;
  const read =
    raw.read ?? (raw.resolved === true ? true : false);
  let type = raw.type ?? "general";
  if (type === "transfer_offer_in") type = "transfer";
  if (type === "cup_draw") type = "fixture";

  return {
    id: raw.id,
    type,
    title: raw.title,
    body: raw.body,
    week,
    season: raw.season ?? career.seasonYear,
    gameWeek: week,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    read,
    resolved: raw.resolved,
    playerId: raw.playerId,
    playerName: raw.playerName,
    offerClub: raw.offerClub,
    offerAmount: raw.offerAmount,
    askingPrice: raw.askingPrice,
    unsolicited: raw.unsolicited,
  };
}

export function pushInboxMessage(
  career: ManagerCareer,
  message: InboxMessage
): ManagerCareer {
  const normalized = normalizeInboxMessage(message, career);
  if (career.inboxMessages.some((m) => m.id === normalized.id)) {
    return career;
  }
  return {
    ...career,
    inboxMessages: [normalized, ...career.inboxMessages],
    updatedAt: new Date().toISOString(),
  };
}

export function resolveInboxMessage(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, resolved: true, read: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function markInboxMessagesRead(career: ManagerCareer): ManagerCareer {
  const hasUnread = career.inboxMessages.some((m) => !m.read);
  if (!hasUnread) return career;
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.read ? m : { ...m, read: true }
    ),
    updatedAt: new Date().toISOString(),
  };
}

function inboxMessageRequiresAction(msg: InboxMessage): boolean {
  if (msg.resolved) return false;
  return msg.type === "transfer" || msg.type === "transfer_offer_in";
}

/** Mark everything read; dismiss informational messages (keeps open transfer bids). */
export function viewAllInboxAsSeen(career: ManagerCareer): ManagerCareer {
  let changed = false;
  const inboxMessages = career.inboxMessages.map((m) => {
    if (m.resolved) {
      if (!m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    }
    if (inboxMessageRequiresAction(m)) {
      if (!m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    }
    changed = true;
    return { ...m, read: true, resolved: true };
  });
  if (!changed) return career;
  return { ...career, inboxMessages, updatedAt: new Date().toISOString() };
}

export function canViewAllInboxAsSeen(career: ManagerCareer): boolean {
  return career.inboxMessages.some((m) => {
    if (!m.read) return true;
    return !m.resolved && !inboxMessageRequiresAction(m);
  });
}

export function createPlayerPurchaseMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  fromClub: string,
  fee: number,
  wagePerYear: number
): InboxMessage {
  return normalizeInboxMessage(
    {
      id: `purchase-${playerId}-w${career.gameWeek}-${Date.now()}`,
      type: "transfer_complete",
      title: "Transfer Completed",
      body: `${playerName} has joined from ${fromClub} for ${formatWage(fee)} on ${formatWage(wagePerYear)}/yr.`,
      read: false,
      resolved: false,
      playerId,
      playerName,
      offerClub: fromClub,
      offerAmount: fee,
    },
    career
  );
}

export function createPlayerSaleMessage(
  career: ManagerCareer,
  playerName: string,
  buyerClub: string,
  fee: number,
  playerId?: string,
  purchaseFee?: number
): InboxMessage {
  const boughtFor =
    purchaseFee ??
    (playerId != null ? career.contracts[playerId]?.purchaseFee : undefined);
  let profitLine = "";
  if (boughtFor != null && boughtFor > 0) {
    const profit = fee - boughtFor;
    profitLine =
      profit >= 0
        ? `\nProfit on transfer: ${formatWage(profit)} (bought for ${formatWage(boughtFor)}).`
        : `\nLoss on transfer: ${formatWage(Math.abs(profit))} (bought for ${formatWage(boughtFor)}).`;
  }

  return normalizeInboxMessage(
    {
      id: `sale-${playerName}-${career.gameWeek}-${Date.now()}`,
      type: "sale",
      title: "Transfer Completed",
      body: `${playerName} has joined ${buyerClub} for ${formatWage(fee)}.\nThe fee has been added to your club funds (transfer and operating budgets).${profitLine}`,
      read: false,
      resolved: false,
      playerId,
      playerName,
    },
    career
  );
}

export function syncCupDrawInboxMessages(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) return career;

  const cupRound = getPendingCupBracketRound(career);
  if (cupRound === null) return career;

  const prepared = prepareCupRound(career);
  const cupMatch = getUserCupMatch(prepared, cupRound);
  if (!cupMatch) return career;

  const msgId = `cup-draw-${cupMatch.matchId}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  const roundLabel = getCupRoundLabel(cupMatch.round);
  const venue = cupMatch.isHome ? "Home" : "Away";

  return pushInboxMessage(career, {
    id: msgId,
    type: "fixture",
    title: "Challenge Cup Draw",
    body: `${roundLabel}: ${career.club} vs ${cupMatch.opponent} (${venue}). Check Fixtures when you're ready to play.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    offerClub: cupMatch.opponent,
  });
}

export function addSeasonRewardInboxMessage(
  career: ManagerCareer
): ManagerCareer {
  const msgId = `season-reward-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  const summary = buildSeasonSummary(career);
  const lines = computeManagerSeasonRewardLines(career, summary);
  const total = formatRewardTotal(lines);
  const position =
    summary.position ??
    getUserLeaguePosition(career.leagueTable, career.club);
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);

  return pushInboxMessage(career, {
    id: msgId,
    type: "season_reward",
    title: "Season Complete",
    body: `${career.seasonYear} season finished — ${position}${getOrdinal(position)} in the league, Challenge Cup: ${cupOutcome.label}. Season earnings available: ${total}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
  });
}

function getOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = n % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

export function syncContractExpiryInboxMessages(
  career: ManagerCareer
): ManagerCareer {
  let next = career;
  for (const ps of career.squad) {
    const contract = career.contracts[ps.playerId];
    const player = getManagerPlayer(career, ps.playerId);
    if (!contract || !player) continue;

    const status = getContractStatus(contract);
    const expiresSoon =
      status === "expires_this_season" ||
      (status === "one_year_left" && career.gameWeek >= 14);

    if (!expiresSoon) continue;

    const msgId = `contract-expiry-${ps.playerId}-s${career.seasonYear}`;
    if (next.inboxMessages.some((m) => m.id === msgId)) continue;

    const timeLeft =
      status === "expires_this_season"
        ? "at the end of this season"
        : "within six months";

    next = pushInboxMessage(next, {
      id: msgId,
      type: "contract",
      title: "Contract Expiring",
      body: `${player.name}'s contract expires ${timeLeft}. Open Contracts to negotiate a renewal.`,
      week: career.gameWeek,
      season: career.seasonYear,
      gameWeek: career.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      resolved: false,
      playerId: ps.playerId,
      playerName: player.name,
    });
  }
  return next;
}

export function addContractRenewalInboxMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  wagePerYear: number,
  years: number,
  squadRole: string
): ManagerCareer {
  const msgId = `contract-renewed-${playerId}-s${career.seasonYear}-w${career.gameWeek}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "contract",
    title: "Contract Renewed",
    body: `${playerName} signed a ${years}-year deal at ${formatWage(wagePerYear)}/yr (${squadRole}).`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName,
  });
}

export function addRetirementIntentInboxMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  age: number
): ManagerCareer {
  const msgId = `retirement-intent-${playerId}-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "retirement",
    title: "Retirement Planned",
    body: `${playerName} (${age}) is considering retirement and plans to call time on their career at the end of the ${career.seasonYear} season.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName,
  });
}

export function addPlayerRetiredInboxMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  age: number
): ManagerCareer {
  const msgId = `retired-${playerId}-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "retirement",
    title: "Player Retired",
    body: `${playerName} has retired from rugby at age ${age} after ${career.seasonYear} season. They leave the club with our best wishes.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName,
  });
}

export function addContractLeavingInboxMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string
): ManagerCareer {
  const msgId = `contract-left-${playerId}-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "contract",
    title: "Player Released",
    body: `${playerName} has left the club — no new contract was agreed.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName,
  });
}

export function renewManagerContract(
  career: ManagerCareer,
  playerId: string,
  offer: import("./types").RenewalDemand
): ManagerCareer {
  const player = getManagerPlayer(career, playerId);
  const next = applyRenewal(career, playerId, offer);
  if (!player) return next;
  return addContractRenewalInboxMessage(
    next,
    playerId,
    player.name,
    offer.wagePerYear,
    offer.yearsRequested,
    offer.squadRole
  );
}

export function bulkRenewExpiringContractsWithInbox(career: ManagerCareer): {
  career: ManagerCareer;
  renewed: number;
  declined: number;
} {
  let working = ensureRenewalDemands(career);
  let renewed = 0;
  let declined = 0;

  for (const ps of working.squad) {
    const contract = working.contracts[ps.playerId];
    if (!contract) continue;
    const status = getContractStatus(contract);
    if (status !== "expires_this_season" && status !== "wants_renewal") {
      continue;
    }

    const demand =
      contract.renewalDemand ??
      generateRenewalDemand(ps.playerId, contract, working);
    const result = evaluateRenewalOffer(ps.playerId, contract, demand, working);
    if (result.accepted) {
      working = renewManagerContract(working, ps.playerId, demand);
      renewed++;
    } else {
      declined++;
    }
  }

  return { career: working, renewed, declined };
}

export const INBOX_MAX_AGE_WEEKS = 7;

/** Clear unresolved transfer state at season rollover. */
export function clearSeasonTransferState(career: ManagerCareer): ManagerCareer {
  return {
    ...career,
    freeAgents: [],
    leagueListedPlayers: [],
    transferMarket: [],
    inboxMessages: career.inboxMessages.map((m) =>
      !m.resolved &&
      (m.type === "transfer" || m.type === "transfer_offer_in")
        ? { ...m, resolved: true, read: true }
        : m
    ),
    playerTransferStatus: {},
  };
}

/** Remove inbox messages older than maxAgeWeeks (by game week). */
export function purgeStaleInboxMessages(
  career: ManagerCareer,
  maxAgeWeeks = INBOX_MAX_AGE_WEEKS
): ManagerCareer {
  const inboxMessages = career.inboxMessages.filter((m) => {
    if (!m.resolved && (m.type === "transfer" || m.type === "transfer_offer_in")) {
      return true;
    }
    const season = m.season ?? career.seasonYear;
    if (season < career.seasonYear) return false;
    const week = m.gameWeek ?? m.week ?? 0;
    return career.gameWeek - week <= maxAgeWeeks && career.gameWeek >= week;
  });
  if (inboxMessages.length === career.inboxMessages.length) return career;
  return { ...career, inboxMessages, updatedAt: new Date().toISOString() };
}

export function syncManagerInboxMessages(career: ManagerCareer): ManagerCareer {
  let next = syncCupDrawInboxMessages(career);
  next = syncContractExpiryInboxMessages(next);
  next = syncReserveContractExpiryInbox(next);
  next = ensureRetirementIntent(next);
  if (next.isSeasonComplete) {
    next = addSeasonRewardInboxMessage(next);
  }
  return purgeStaleInboxMessages(next);
}

export function countUnreadInbox(career: ManagerCareer): number {
  return career.inboxMessages.filter((m) => !m.read).length;
}

export function hydrateInboxMessages(career: ManagerCareer): ManagerCareer {
  const hydrated = {
    ...career,
    inboxMessages: (career.inboxMessages ?? []).map((m) =>
      normalizeInboxMessage(m, career)
    ),
  };
  return purgeStaleInboxMessages(hydrated);
}

export function addReserveCallUpInboxMessage(
  career: ManagerCareer,
  playerId: string,
  playerName: string,
  positionLabel: string
): ManagerCareer {
  return pushInboxMessage(career, {
    id: `reserve-callup-${playerId}-w${career.gameWeek}-${Date.now()}`,
    type: "reserve_callup",
    title: "Reserve Called Up",
    body: `${playerName} (${positionLabel}) has been called up to the matchday squad for the next fixture.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName,
  });
}

export function addReserveReturnInboxMessage(
  career: ManagerCareer,
  players: { id: string; name: string }[]
): ManagerCareer {
  if (players.length === 0) return career;

  const names = players.map((p) => p.name);
  const body =
    players.length === 1
      ? `${names[0]} has returned to the reserve squad after the match.`
      : `${names.join(", ")} have returned to the reserve squad after the match.`;

  return pushInboxMessage(career, {
    id: `reserve-return-w${career.gameWeek}-${players.map((p) => p.id).sort().join("-")}`,
    type: "reserve_return",
    title: "Returned To Reserves",
    body,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerName: names.join(", "),
  });
}

export function addYouthIntakeInboxMessage(
  career: ManagerCareer,
  count: number,
  summary: string
): ManagerCareer {
  const msgId = `youth-intake-s${career.seasonYear}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "youth_intake",
    title: "Youth Intake",
    body: `${count} new academy prospects are available to sign: ${summary}. Open Reserves to offer youth contracts.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
  });
}

export function addReserveContractRenewalInboxMessage(
  career: ManagerCareer,
  reserveId: string,
  playerName: string,
  wagePerYear: number,
  years: number
): ManagerCareer {
  const msgId = `reserve-renewed-${reserveId}-s${career.seasonYear}-w${career.gameWeek}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "contract",
    title: "Reserve Contract Renewed",
    body: `${playerName} signed a ${years}-year youth deal at ${formatWage(wagePerYear)}/yr.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId: reserveId,
    playerName,
  });
}
