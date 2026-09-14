/**
 * AI Club Management Engine.
 * AI clubs renew squads, fill positional holes, bid for listed + unlisted targets
 * (including the human manager), resolve AI↔AI deals, and generate loan offers.
 */

import { buildBestLineup, isHalfbackPosition } from "./database";
import { calculateSalaryCapUsage } from "./contracts";
import {
  calculateMarketWage,
  calculateTransferFeeBetweenClubs,
  AI_CONTRACT_RETENTION,
  isRecentlySignedPlayer,
  isTransferWindowOpen,
  MATCHDAY_RULES,
} from "./rules";
import {
  submitTransferBid,
  evaluateSellingClubBid,
  evaluatePlayerTransferTerms,
  completeTransfer,
} from "./transfers";
import { createLoanAgreement } from "./loans";
import type {
  ManagerState,
  ManagerPlayer,
  Position,
  PendingLoanOffer,
} from "./types";

const EMPTY_POS_COUNTS = (): Record<Position, number> => ({
  FULLBACK: 0,
  WING: 0,
  CENTRE: 0,
  STAND_OFF: 0,
  SCRUM_HALF: 0,
  PROP: 0,
  HOOKER: 0,
  SECOND_ROW: 0,
  LOOSE_FORWARD: 0,
});

function countPositions(players: ManagerPlayer[]): Record<Position, number> {
  const counts = EMPTY_POS_COUNTS();
  for (const p of players) {
    if (p.squadTier === "first" || p.squadTier === "reserves") {
      counts[p.position] = (counts[p.position] || 0) + 1;
    }
  }
  return counts;
}

/** Fit first-team + loaned-in players currently available to the club. */
function availableFirstTeamPool(
  state: ManagerState,
  clubId: string
): ManagerPlayer[] {
  return Object.values(state.players).filter(
    (p) =>
      !p.injury &&
      !p.suspension &&
      ((p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
        p.loan?.destinationClubId === clubId)
  );
}

function playerCoversPosition(player: ManagerPlayer, pos: Position): boolean {
  if (isHalfbackPosition(pos)) {
    return (
      isHalfbackPosition(player.position) ||
      isHalfbackPosition(player.secondaryPosition)
    );
  }
  return player.position === pos || player.secondaryPosition === pos;
}

/**
 * AI may loan a player *into* the human club only when:
 * - the matchday first-team pool is short of 17, or
 * - the loanee is a clear upgrade over existing cover at that position
 *   (stops spam offers for depth the squad already has).
 */
function shouldOfferIncomingLoanToUser(
  state: ManagerState,
  userClubId: string,
  candidate: ManagerPlayer
): boolean {
  const pool = availableFirstTeamPool(state, userClubId);
  if (pool.length < MATCHDAY_RULES.SQUAD_SIZE) return true;

  const samePos = pool.filter((p) => playerCoversPosition(p, candidate.position));
  if (samePos.length === 0) return true;

  const weakest = Math.min(...samePos.map((p) => p.rating));
  // Must beat current depth — marginal equals are not worth a popup.
  return candidate.rating > weakest;
}

function pushPendingLoanOffer(
  state: ManagerState,
  offer: PendingLoanOffer
): ManagerState {
  const existing = state.transfers.pendingLoanOffers || [];
  if (existing.some((o) => o.id === offer.id)) return state;
  if (existing.some((o) => o.playerId === offer.playerId && o.direction === offer.direction)) {
    return state;
  }
  return {
    ...state,
    transfers: {
      ...state.transfers,
      pendingLoanOffers: [offer, ...existing],
    },
  };
}

/** Quietly finish AI↔AI bids so the market actually moves. */
function resolvePendingAiAiBids(state: ManagerState, userClubId: string): ManagerState {
  let next = state;
  const pending = next.transfers.activeBids.filter(
    (b) =>
      b.status === "pending_club" &&
      b.fromClubId !== userClubId &&
      b.toClubId !== userClubId
  );

  for (const bid of pending) {
    const clubEval = evaluateSellingClubBid(next, bid.id, undefined, { silent: true });
    if (!clubEval.success) continue;
    next = clubEval.state;
    if (clubEval.bid?.status !== "club_accepted") continue;

    const terms = evaluatePlayerTransferTerms(next, bid.id, { silent: true });
    if (!terms.success) continue;
    next = terms.state;
    if (terms.bid?.status !== "player_accepted") continue;

    const done = completeTransfer(next, bid.id);
    if (done.success) next = done.state;
  }

  return next;
}

export function processAiDecisionsForWeek(state: ManagerState): ManagerState {
  let nextState = state;
  const userClubId = state.manager.clubId;
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;
  let userBidsThisWeek = 0;
  let userLoanOffersThisWeek = 0;

  // Settle leftover AI↔AI bids before new ones are created
  nextState = resolvePendingAiAiBids(nextState, userClubId);

  // Drop incoming loan popups that aren't useful (full squad, no upgrade).
  {
    const pending = nextState.transfers.pendingLoanOffers || [];
    const kept = pending.filter((o) => {
      if (o.direction !== "in" || o.destinationClubId !== userClubId) return true;
      const player = nextState.players[o.playerId];
      if (!player) return false;
      return shouldOfferIncomingLoanToUser(nextState, userClubId, player);
    });
    if (kept.length !== pending.length) {
      nextState = {
        ...nextState,
        transfers: { ...nextState.transfers, pendingLoanOffers: kept },
      };
    }
  }

  // Shuffle so the same clubs (e.g. Widnes) are not always last for weekly loan quotas
  const clubIds = Object.keys(nextState.clubs)
    .filter((id) => id !== userClubId)
    .sort(() => Math.random() - 0.5);

  for (const clubId of clubIds) {
    const club = nextState.clubs[clubId];
    if (!club) continue;

    let clubPlayers = Object.values(nextState.players).filter(
      (p) => p.clubId === clubId && !p.isRetired
    );
    let cap = calculateSalaryCapUsage(nextState, clubId);

    // 1. Contract renewals — retain most of the usable squad, not only stars
    const expiring = clubPlayers.filter(
      (p) => p.contract && p.contract.expiresSeason <= currentSeason && !p.loan
    );
    const renewPriority = [...expiring].sort((a, b) => {
      const score = (p: ManagerPlayer) =>
        p.rating +
        (p.contract?.role === "star" ? 8 : 0) +
        (p.squadTier === "first" ? 6 : 0) +
        (p.potential >= 82 ? 4 : 0);
      return score(b) - score(a);
    });

    for (const expPlayer of renewPriority) {
      const mustKeep =
        expPlayer.squadTier === "first" ||
        expPlayer.rating >= AI_CONTRACT_RETENTION.MUST_KEEP_RATING ||
        expPlayer.contract?.role === "star";
      const keep =
        mustKeep ||
        expPlayer.rating >= AI_CONTRACT_RETENTION.KEEP_RATING ||
        expPlayer.potential >= 80;
      if (!keep) continue;

      const bump = expPlayer.rating >= 80 ? 1.06 : 1.04;
      const bumpedWage = Math.round((expPlayer.contract!.wageWeekly * bump) / 50) * 50;
      const flatWage = expPlayer.contract!.wageWeekly;
      const wageDelta = bumpedWage - flatWage;
      const loyaltyBuffer =
        expPlayer.rating < 86
          ? Math.round(cap.capLimitWeekly * 0.12)
          : 0;

      let proposedWage = bumpedWage;
      if (wageDelta > 0 && cap.availableCapWeekly + loyaltyBuffer < wageDelta) {
        // Cap squeeze: still flat-renew quality players instead of dumping them to FA.
        if (
          mustKeep ||
          expPlayer.rating >= AI_CONTRACT_RETENTION.FLAT_RENEW_RATING
        ) {
          proposedWage = flatWage;
        } else {
          continue;
        }
      }

      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [expPlayer.id]: {
            ...expPlayer,
            contract: {
              ...expPlayer.contract!,
              wageWeekly: proposedWage,
              expiresSeason:
                currentSeason +
                (expPlayer.rating >= 78 ? 3 : expPlayer.rating >= 70 ? 2 : 1),
            },
            morale: Math.min(100, expPlayer.morale + (proposedWage > flatWage ? 6 : 3)),
          },
        },
      };
      cap = calculateSalaryCapUsage(nextState, clubId);
    }

    clubPlayers = Object.values(nextState.players).filter(
      (p) => p.clubId === clubId && !p.isRetired
    );

    // 2. Promote academy talent
    for (const talent of clubPlayers.filter(
      (p) =>
        p.squadTier === "academy" &&
        (p.rating >= 68 || (p.age >= 19 && p.potential >= 82))
    )) {
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [talent.id]: {
            ...talent,
            squadTier: "reserves",
            academyProductOfClubId: talent.academyProductOfClubId || clubId,
            morale: Math.min(100, talent.morale + 10),
          },
        },
      };
    }

    clubPlayers = Object.values(nextState.players).filter(
      (p) => p.clubId === clubId && !p.isRetired
    );
    cap = calculateSalaryCapUsage(nextState, clubId);

    // 3. Transfers & free agents during the open window
    if (isTransferWindowOpen(currentWeek) && currentWeek % 2 === 0) {
      // 3a. Explicit chase of listed / star human players (not only positional holes)
      if (userBidsThisWeek < 2 && club.finances.balance > 25_000) {
        const userTargets = Object.values(nextState.players)
          .filter(
            (p) =>
              p.clubId === userClubId &&
              !p.loan &&
              !p.injury &&
              !p.suspension &&
              !p.transfersBlocked &&
              !isRecentlySignedPlayer(p, currentSeason, currentWeek) &&
              (p.isTransferListed ||
                p.contract?.role === "star" ||
                (p.rating >= 78 && p.squadTier === "first") ||
                (p.potential >= 86 && p.age <= 24))
          )
          .sort((a, b) => {
            const score = (x: typeof a) =>
              x.rating +
              (x.isTransferListed ? 6 : 0) +
              (x.contract?.role === "star" ? 4 : 0);
            return score(b) - score(a);
          });

        const hunt = userTargets[0];
        if (
          hunt &&
          (hunt.isTransferListed || Math.random() < 0.45) &&
          !nextState.transfers.activeBids.some(
            (b) =>
              b.playerId === hunt.id &&
              b.fromClubId === clubId &&
              (b.status === "pending_club" || b.status === "club_accepted")
          )
        ) {
          const sellingComp =
            nextState.clubs[userClubId]?.competitionId || club.competitionId;
          let fairFee = calculateTransferFeeBetweenClubs(
            hunt.rating,
            hunt.potential,
            hunt.age,
            club.competitionId,
            sellingComp
          );
          if (!hunt.isTransferListed) {
            fairFee = Math.round((fairFee * 1.2) / 1000) * 1000;
          }
          const proposedWage = calculateMarketWage(
            hunt.rating,
            hunt.age,
            club.competitionId
          );
          if (
            club.finances.balance >= fairFee &&
            cap.availableCapWeekly >= proposedWage
          ) {
            const role = hunt.rating >= 82 ? ("star" as const) : ("first_team" as const);
            const bidResult = submitTransferBid(
              nextState,
              clubId,
              hunt.id,
              fairFee,
              proposedWage,
              role,
              2,
              { silent: true }
            );
            if (bidResult.success) {
              nextState = bidResult.state;
              userBidsThisWeek++;
              cap = calculateSalaryCapUsage(nextState, clubId);
            }
          }
        }
      }

      const positionCounts = countPositions(clubPlayers);
      const weakPos = (Object.entries(positionCounts) as [Position, number][]).find(
        ([, count]) => count < 2
      );
      const huntingUpgrade = !weakPos && currentWeek % 4 === 0;

      let neededPos: Position | null = weakPos ? weakPos[0] : null;
      if (!neededPos && huntingUpgrade) {
        // Chase a mild upgrade at a thin first-team role
        const firstCounts = EMPTY_POS_COUNTS();
        for (const p of clubPlayers.filter((x) => x.squadTier === "first" && !x.loan)) {
          firstCounts[p.position] = (firstCounts[p.position] || 0) + 1;
        }
        const thin = (Object.entries(firstCounts) as [Position, number][]).find(
          ([, c]) => c < 2
        );
        neededPos = thin?.[0] || null;
      }

      if (neededPos) {
        const minRating = weakPos ? 62 : Math.max(70, club.reputation * 14);
        const candidates = Object.values(nextState.players)
          .filter(
            (p) =>
              (p.position === neededPos || p.secondaryPosition === neededPos) &&
              !p.injury &&
              !p.suspension &&
              !p.loan &&
              !p.transfersBlocked &&
              p.clubId !== clubId &&
              p.rating >= minRating &&
              !(
                p.clubId &&
                isRecentlySignedPlayer(p, currentSeason, currentWeek)
              ) &&
              (p.isTransferListed ||
                p.clubId === null ||
                // Unlisted targets: only if they are a clear need / value chase
                (p.clubId === userClubId &&
                  (p.isTransferListed ||
                    p.rating >= 76 ||
                    p.potential >= 84 ||
                    p.contract?.role === "star")) ||
                (p.clubId &&
                  p.clubId !== userClubId &&
                  (p.isTransferListed || (p.age >= 30 && p.rating >= 74))))
          )
          .sort((a, b) => {
            const listedBoost = (x: ManagerPlayer) => (x.isTransferListed || !x.clubId ? 3 : 0);
            return b.rating + listedBoost(b) - (a.rating + listedBoost(a));
          });

        const target = candidates[0];
        if (target) {
          const sellingComp = target.clubId
            ? nextState.clubs[target.clubId]?.competitionId || club.competitionId
            : club.competitionId;
          let fairFee = calculateTransferFeeBetweenClubs(
            target.rating,
            target.potential,
            target.age,
            club.competitionId,
            sellingComp
          );
          if (target.clubId && !target.isTransferListed) {
            fairFee = Math.round((fairFee * 1.18) / 1000) * 1000;
          }
          const proposedWage = calculateMarketWage(
            target.rating,
            target.age,
            club.competitionId
          );
          const role =
            target.rating >= 82 ? ("star" as const) : ("first_team" as const);

          if (target.clubId === null && cap.availableCapWeekly >= proposedWage) {
            nextState = {
              ...nextState,
              players: {
                ...nextState.players,
                [target.id]: {
                  ...target,
                  clubId,
                  squadTier: "first",
                  joinedSeason: currentSeason,
                  joinedWeek: currentWeek,
                  contract: {
                    wageWeekly: proposedWage,
                    expiresSeason: currentSeason + 2,
                    role,
                  },
                },
              },
            };
            cap = calculateSalaryCapUsage(nextState, clubId);
          } else if (
            target.clubId &&
            target.clubId !== userClubId &&
            club.finances.balance >= fairFee &&
            cap.availableCapWeekly >= proposedWage
          ) {
            const bidResult = submitTransferBid(
              nextState,
              clubId,
              target.id,
              fairFee,
              proposedWage,
              role,
              2
            );
            if (bidResult.success) {
              nextState = bidResult.state;
            }
          } else if (
            target.clubId === userClubId &&
            userBidsThisWeek < 2 &&
            club.finances.balance >= fairFee &&
            cap.availableCapWeekly >= proposedWage
          ) {
            const alreadyBidding = nextState.transfers.activeBids.some(
              (b) =>
                b.playerId === target.id &&
                b.fromClubId === clubId &&
                (b.status === "pending_club" || b.status === "club_accepted")
            );
            if (!alreadyBidding) {
              const bidResult = submitTransferBid(
                nextState,
                clubId,
                target.id,
                fairFee,
                proposedWage,
                role,
                2,
                { silent: true }
              );
              if (bidResult.success) {
                nextState = bidResult.state;
                userBidsThisWeek++;
              }
            }
          }
        }
      }
    }

    // 4. Loan out reserves to Championship (and occasionally to the user)
    if (club.competitionId === "super-league" && currentWeek <= 18 && currentWeek % 3 === 0) {
      const loanCandidate = clubPlayers.find(
        (p) =>
          (p.squadTier === "reserves" || p.squadTier === "academy") &&
          p.age <= 23 &&
          p.rating >= 64 &&
          p.rating <= 78 &&
          !p.loan
      );
      if (loanCandidate) {
        const champClubs = Object.values(nextState.clubs)
          .filter((c) => c.competitionId === "championship")
          .sort(() => Math.random() - 0.5);
        const userWantsLoan =
          userLoanOffersThisWeek < 1 &&
          Math.random() < 0.35 &&
          shouldOfferIncomingLoanToUser(nextState, userClubId, loanCandidate);
        const dest = userWantsLoan
          ? nextState.clubs[userClubId]
          : champClubs[0];

        if (dest && dest.id === userClubId) {
          nextState = pushPendingLoanOffer(nextState, {
            id: `loan_offer_in_${loanCandidate.id}_${currentWeek}`,
            playerId: loanCandidate.id,
            parentClubId: clubId,
            destinationClubId: userClubId,
            totalWeeks: 8,
            wageContributionPct: 50,
            canRecall: true,
            season: currentSeason,
            week: currentWeek,
            direction: "in",
          });
          userLoanOffersThisWeek++;
        } else if (dest && dest.id !== userClubId) {
          const loanRes = createLoanAgreement(
            nextState,
            clubId,
            dest.id,
            loanCandidate.id,
            8,
            50,
            true
          );
          if (loanRes.success) nextState = loanRes.state;
        }
      }
    }

    // 5. Ask to loan the user's fringe / youth players
    if (
      currentWeek <= 16 &&
      currentWeek % 4 === 0 &&
      userLoanOffersThisWeek < 2 &&
      Math.random() < 0.4
    ) {
      const userClub = nextState.clubs[userClubId];
      const userIsChamp = userClub?.competitionId === "championship";
      const userIsSL = userClub?.competitionId === "super-league";
      const askerIsSL = club.competitionId === "super-league";
      const askerBase = askerIsSL
        ? club.reputation >= 4
          ? 78
          : 72
        : club.reputation === 3
          ? 68
          : 62;

      const userFringe = Object.values(nextState.players).filter((p) => {
        if (
          p.clubId !== userClubId ||
          p.loan ||
          p.injury ||
          p.age > 24 ||
          p.rating < 62 ||
          p.rating > 78
        ) {
          return false;
        }
        const tierOk =
          p.squadTier === "reserves" ||
          p.squadTier === "academy" ||
          (p.squadTier === "first" && p.rating < 74);
        if (!tierOk) return false;

        // SL askers: only from Champ users, or competitive SL fringe (≥70 and near asker level)
        if (askerIsSL) {
          if (userIsChamp) return true;
          if (userIsSL) {
            return p.rating >= 70 && p.rating >= askerBase - 3;
          }
          return false;
        }
        // Champ askers get equal chance via shuffled club order; can take Champ fringe (or SL youth)
        return true;
      });

      if (userFringe.length > 0) {
        const pick = userFringe[Math.floor(Math.random() * userFringe.length)];
        const parentComp = nextState.clubs[userClubId]?.competitionId;
        const canBorrow =
          !(parentComp === "championship" && club.competitionId === "super-league");
        if (canBorrow) {
          nextState = pushPendingLoanOffer(nextState, {
            id: `loan_offer_out_${pick.id}_${clubId}_${currentWeek}`,
            playerId: pick.id,
            parentClubId: userClubId,
            destinationClubId: clubId,
            totalWeeks: 10,
            wageContributionPct: 60,
            canRecall: true,
            season: currentSeason,
            week: currentWeek,
            direction: "out",
          });
          userLoanOffersThisWeek++;
        }
      }
    }

    // 6. Refresh AI matchday 17
    const activeSquad = Object.values(nextState.players).filter(
      (p) =>
        (p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
        (p.loan && p.loan.destinationClubId === clubId)
    );
    nextState = {
      ...nextState,
      clubs: {
        ...nextState.clubs,
        [clubId]: {
          ...nextState.clubs[clubId],
          lineup: buildBestLineup(activeSquad),
        },
      },
    };
  }

  // Resolve any fresh AI↔AI bids created this week
  nextState = resolvePendingAiAiBids(nextState, userClubId);

  return nextState;
}

/**
 * Last-chance flat renewals before season rollover dumps unre-signed talent to free agency.
 * User club is never auto-renewed.
 */
export function forceRetainAiExpiringContracts(
  state: ManagerState,
  expiringSeason: number
): ManagerState {
  const userClubId = state.manager.clubId;
  let nextPlayers = { ...state.players };
  let changed = false;

  for (const clubId of Object.keys(state.clubs)) {
    if (clubId === userClubId) continue;

    const expiring = Object.values(nextPlayers).filter(
      (p) =>
        p.clubId === clubId &&
        !p.isRetired &&
        !p.loan &&
        p.contract &&
        p.contract.expiresSeason <= expiringSeason
    );

    for (const p of expiring) {
      const mustKeep =
        p.squadTier === "first" ||
        p.rating >= AI_CONTRACT_RETENTION.MUST_KEEP_RATING ||
        p.contract?.role === "star";
      if (!mustKeep && p.rating < AI_CONTRACT_RETENTION.FLAT_RENEW_RATING) {
        continue;
      }

      nextPlayers[p.id] = {
        ...p,
        contract: {
          ...p.contract!,
          // Flat renew — no wage bump at the hard boundary
          expiresSeason:
            expiringSeason + (p.rating >= 78 ? 3 : p.rating >= 70 ? 2 : 1),
        },
        morale: Math.min(100, p.morale + 2),
      };
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, players: nextPlayers };
}
