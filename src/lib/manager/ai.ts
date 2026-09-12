/**
 * AI Club Management Engine.
 * Enables both Super League and Championship AI clubs to realistically
 * manage squads, renew key contracts, promote academy talent, bid on transfers,
 * and adjust lineups.
 */

import { buildBestLineup } from "./database";
import { calculateSalaryCapUsage } from "./contracts";
import { calculateMarketWage, calculatePlayerValue } from "./rules";
import { submitTransferBid } from "./transfers";
import { createLoanAgreement } from "./loans";
import type {
  ManagerState,
  ManagerClub,
  ManagerPlayer,
  Position,
} from "./types";

export function processAiDecisionsForWeek(state: ManagerState): ManagerState {
  let nextState = state;
  const userClubId = state.manager.clubId;
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;

  // Process all AI clubs
  for (const [clubId, club] of Object.entries(state.clubs)) {
    if (clubId === userClubId) continue; // Do not touch human manager's decisions

    const clubPlayers = Object.values(nextState.players).filter((p) => p.clubId === clubId && !p.isRetired);
    const cap = calculateSalaryCapUsage(nextState, clubId);

    // 1. AI Contract Renewals: renew top players expiring this season
    const expiring = clubPlayers.filter(
      (p) => p.contract && p.contract.expiresSeason <= currentSeason && !p.loan
    );

    for (const expPlayer of expiring) {
      // Prioritize key players
      const isValuable = expPlayer.rating >= 72 || expPlayer.potential >= 82 || expPlayer.contract?.role === "star";
      if (!isValuable) continue;

      const proposedWage = Math.round(expPlayer.contract!.wageWeekly * 1.08);
      const wageDelta = proposedWage - expPlayer.contract!.wageWeekly;

      if (cap.availableCapWeekly >= wageDelta) {
        const updatedContract = {
          ...expPlayer.contract!,
          wageWeekly: proposedWage,
          expiresSeason: currentSeason + 2,
        };

        nextState = {
          ...nextState,
          players: {
            ...nextState.players,
            [expPlayer.id]: {
              ...expPlayer,
              contract: updatedContract,
              morale: Math.min(100, expPlayer.morale + 8),
            },
          },
        };
      }
    }

    // 2. AI Squad Movement: Promote high-potential academy players
    const academyTalents = clubPlayers.filter(
      (p) => p.squadTier === "academy" && (p.rating >= 68 || (p.age >= 19 && p.potential >= 82))
    );
    for (const talent of academyTalents) {
      nextState = {
        ...nextState,
        players: {
          ...nextState.players,
          [talent.id]: {
            ...talent,
            squadTier: "reserves",
            morale: Math.min(100, talent.morale + 10),
          },
        },
      };
    }

    // 3. AI Transfers & Free Agents (every few weeks during open window)
    if (currentWeek <= 24 && currentWeek % 3 === 0) {
      // Check positional coverage
      const positionCounts: Record<Position, number> = {
        FULLBACK: 0, WING: 0, CENTRE: 0, STAND_OFF: 0, SCRUM_HALF: 0,
        PROP: 0, HOOKER: 0, SECOND_ROW: 0, LOOSE_FORWARD: 0,
      };
      clubPlayers.forEach((p) => {
        if (p.squadTier === "first" || p.squadTier === "reserves") {
          positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
        }
      });

      // Find any weak position (< 2 players)
      const weakPos = (Object.entries(positionCounts) as [Position, number][]).find(([_, count]) => count < 2);
      if (weakPos) {
        const neededPos = weakPos[0];

        // Search for transfer listed players or free agents
        const candidates = Object.values(nextState.players).filter(
          (p) =>
            p.position === neededPos &&
            !p.injury &&
            !p.suspension &&
            p.clubId !== clubId &&
            (p.isTransferListed || p.clubId === null)
        ).sort((a, b) => b.rating - a.rating);

        const target = candidates[0];
        if (target) {
          const fairFee = calculatePlayerValue(target.rating, target.potential, target.age);
          const proposedWage = calculateMarketWage(target.rating, target.age, club.competitionId);

          if (target.clubId === null && cap.availableCapWeekly >= proposedWage) {
            // Sign Free Agent directly
            nextState = {
              ...nextState,
              players: {
                ...nextState.players,
                [target.id]: {
                  ...target,
                  clubId,
                  squadTier: "first",
                  contract: {
                    wageWeekly: proposedWage,
                    expiresSeason: currentSeason + 2,
                    role: target.rating >= 78 ? "star" : "first_team",
                  },
                },
              },
            };
          } else if (
            target.clubId &&
            target.clubId !== userClubId &&
            club.finances.balance >= fairFee &&
            cap.availableCapWeekly >= proposedWage
          ) {
            // AI to AI transfer bid submission
            const bidResult = submitTransferBid(
              nextState,
              clubId,
              target.id,
              fairFee,
              proposedWage,
              "first_team",
              2
            );
            if (bidResult.success) {
              nextState = bidResult.state;
            }
          } else if (
            target.clubId === userClubId &&
            club.finances.balance >= fairFee &&
            cap.availableCapWeekly >= proposedWage
          ) {
            // AI bidding for a human manager's player!
            const bidResult = submitTransferBid(
              nextState,
              clubId,
              target.id,
              fairFee,
              proposedWage,
              "first_team",
              2
            );
            if (bidResult.success) {
              nextState = {
                ...bidResult.state,
                inbox: {
                  ...bidResult.state.inbox,
                  messages: [
                    {
                      id: `inbox_incoming_bid_${target.id}_${Date.now()}`,
                      season: currentSeason,
                      week: currentWeek,
                      dateStr: `Week ${currentWeek}`,
                      sender: `${club.name} Chief Executive`,
                      subject: `Transfer Bid Received: £${fairFee.toLocaleString()} for ${target.name}`,
                      body: `${club.name} has submitted an official transfer offer of £${fairFee.toLocaleString()} for ${target.name}. Review and accept or reject in Transfers.`,
                      category: "transfer",
                      isRead: false,
                      actionRequired: true,
                      relatedEntityId: bidResult.bid?.id,
                    },
                    ...bidResult.state.inbox.messages,
                  ],
                  unreadCount: bidResult.state.inbox.unreadCount + 1,
                },
              };
            }
          }
        }
      }
    }

    // 4. AI Loan Opportunities: Super League loaning reserves to Championship clubs
    if (club.competitionId === "super-league" && currentWeek <= 16 && currentWeek % 4 === 0) {
      const loanCandidate = clubPlayers.find(
        (p) => p.squadTier === "reserves" && p.age <= 22 && p.rating >= 66 && p.rating <= 76 && !p.loan
      );
      if (loanCandidate) {
        // Find a Championship club that needs depth
        const champClubs = Object.values(nextState.clubs).filter((c) => c.competitionId === "championship");
        const dest = champClubs[Math.floor(Math.random() * champClubs.length)];
        if (dest && dest.id !== userClubId) {
          const loanRes = createLoanAgreement(nextState, clubId, dest.id, loanCandidate.id, 8, 50, true);
          if (loanRes.success) {
            nextState = loanRes.state;
          }
        }
      }
    }

    // 5. Update AI Matchday Lineup
    const activeSquad = Object.values(nextState.players).filter(
      (p) =>
        (p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
        (p.loan && p.loan.destinationClubId === clubId)
    );
    const freshLineup = buildBestLineup(activeSquad);

    nextState = {
      ...nextState,
      clubs: {
        ...nextState.clubs,
        [clubId]: {
          ...nextState.clubs[clubId],
          lineup: freshLineup,
        },
      },
    };
  }

  return nextState;
}
