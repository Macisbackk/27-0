/**
 * Transfer-state invariants — used by tests and optional dev diagnostics.
 */
import { isSameManagerClub } from "../clubs/super-league-display";
import type { ManagerCareer } from "./types";
import { getPlayerRegistration } from "./playerRegistration";
import {
  getTrackedLeagueClubsForTransferMarket,
  getUserClubPlayerIds,
} from "./managerLeagueRosters";
import { getActiveLoan } from "./managerLoans";
import { isFreeAgent } from "./managerFreeAgents";

export type TransferInvariantResult = {
  valid: boolean;
  violations: string[];
};

/** Prefer the public helper; fall back to tracked clubs if export missing. */
function trackedClubs(career: ManagerCareer): string[] {
  try {
    return getTrackedLeagueClubsForTransferMarket(career);
  } catch {
    return Object.keys(career.leagueClubRosters ?? {});
  }
}

export function assertSingleTransferState(
  career: ManagerCareer,
  playerId: string
): TransferInvariantResult {
  const violations: string[] = [];
  const reg = getPlayerRegistration(career, playerId);
  const loan = getActiveLoan(career, playerId);
  const free = isFreeAgent(career, playerId);
  const userIds = getUserClubPlayerIds(career);

  if (free && (reg.owningClubId || reg.playingClubId)) {
    if (userIds.has(playerId) || loan) {
      violations.push("Free agent still registered to a club or loan.");
    }
  }

  if (free && userIds.has(playerId)) {
    violations.push("Free agent still in user squad/reserves/youth.");
  }

  if (loan) {
    if (isSameManagerClub(loan.parentClub, loan.loaneeClub)) {
      violations.push("Loan parent and loanee are the same club.");
    }
    if (
      isSameManagerClub(loan.parentClub, career.club) &&
      career.squad.some((p) => p.playerId === playerId)
    ) {
      violations.push("Loaned-out player still in parent selectable squad.");
    }
  }

  let aiHits = 0;
  for (const club of trackedClubs(career)) {
    if (isSameManagerClub(club, career.club)) continue;
    const ids =
      (career.leagueClubRosters?.[club] as string[] | undefined) ?? [];
    if (ids.includes(playerId)) aiHits += 1;
  }
  if (aiHits > 1) {
    violations.push(`Player appears on ${aiHits} AI club rosters.`);
  }

  if (userIds.has(playerId) && aiHits > 0 && !loan) {
    violations.push("Player is both user-owned and on an AI roster.");
  }

  const permanentOfferClubs = new Set<string>();
  const loanOfferClubs = new Set<string>();
  for (const m of career.inboxMessages) {
    if (m.resolved || m.playerId !== playerId || !m.offerClub) continue;
    if (m.type !== "transfer" && m.type !== "transfer_offer_in") continue;
    if (m.loanOffer) loanOfferClubs.add(m.offerClub);
    else permanentOfferClubs.add(m.offerClub);
  }
  for (const club of permanentOfferClubs) {
    if ([...loanOfferClubs].some((c) => isSameManagerClub(c, club))) {
      violations.push(
        `Same club has both permanent and loan offers pending (${club}).`
      );
    }
  }

  return { valid: violations.length === 0, violations };
}

export function assertCareerTransferInvariants(
  career: ManagerCareer
): TransferInvariantResult {
  const violations: string[] = [];
  const seen = new Set<string>();

  for (const p of career.squad) seen.add(p.playerId);
  for (const r of career.reserves ?? []) seen.add(r.id);
  for (const y of career.youthProspects ?? []) seen.add(y.id);
  for (const fa of career.freeAgents ?? []) seen.add(fa.playerId);
  for (const loan of career.activeLoans ?? []) seen.add(loan.playerId);
  for (const listing of career.leagueListedPlayers) seen.add(listing.playerId);

  for (const playerId of seen) {
    const result = assertSingleTransferState(career, playerId);
    for (const v of result.violations) {
      violations.push(`${playerId}: ${v}`);
    }
  }

  return { valid: violations.length === 0, violations };
}

/** Dev logging helper — never silently overwrite bad state. */
export function logTransferInvariantFailure(
  career: ManagerCareer,
  playerId: string,
  source: string
): void {
  const result = assertSingleTransferState(career, playerId);
  if (result.valid) return;
  const reg = getPlayerRegistration(career, playerId);
  console.warn("[transfer-invariant]", {
    source,
    playerId,
    registration: reg,
    violations: result.violations,
    week: career.gameWeek,
    season: career.seasonYear,
  });
}
