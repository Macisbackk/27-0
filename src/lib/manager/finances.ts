/**
 * Club finances: wages, matchday gate receipts, prize money, expenses, and transaction logs.
 * Pure simulation logic.
 */

import type {
  ClubFinances,
  FinancialTransaction,
  ManagerClub,
  ManagerState,
} from "./types";

export function processWeeklyFinances(
  state: ManagerState,
  matchesPlayedThisWeek: { homeClubId: string; attendance?: number }[]
): Record<string, ClubFinances> {
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;
  const updatedFinances: Record<string, ClubFinances> = {};

  for (const [clubId, club] of Object.entries(state.clubs)) {
    let balance = club.finances.balance;
    let seasonExpenses = club.finances.seasonExpenses;
    let seasonRevenue = club.finances.seasonRevenue;
    const history: FinancialTransaction[] = [...club.finances.history];

    // 1. Calculate player wages
    const clubPlayers = Object.values(state.players).filter((p) => p.clubId === clubId && p.contract);
    let totalWages = 0;

    for (const p of clubPlayers) {
      const baseWage = p.contract?.wageWeekly || 0;
      if (p.loan) {
        // Parent club pays remaining %, dest pays wageContributionPct
        const parentContribution = 100 - p.loan.wageContributionPct;
        totalWages += Math.round((baseWage * parentContribution) / 100);
      } else {
        totalWages += baseWage;
      }
    }

    // Add incoming loan contributions (players on loan TO this club)
    const loanedInPlayers = Object.values(state.players).filter(
      (p) => p.loan && p.loan.destinationClubId === clubId && p.contract
    );
    for (const p of loanedInPlayers) {
      if (p.loan && p.contract) {
        totalWages += Math.round((p.contract.wageWeekly * p.loan.wageContributionPct) / 100);
      }
    }

    balance -= totalWages;
    seasonExpenses += totalWages;
    history.unshift({
      id: `wages_${clubId}_${currentSeason}_w${currentWeek}`,
      season: currentSeason,
      week: currentWeek,
      amount: -totalWages,
      category: "wages",
      description: `Player and staff wages (£${totalWages.toLocaleString()})`,
    });

    // 2. Gate receipts for home fixtures
    const homeMatches = matchesPlayedThisWeek.filter((m) => m.homeClubId === clubId);
    for (const m of homeMatches) {
      const att = m.attendance || Math.round(club.facilities.stadiumCapacity * 0.6);
      const ticketPrice = club.competitionId === "super-league" ? 22 : 14;
      const matchRevenue = Math.round(att * ticketPrice);

      balance += matchRevenue;
      seasonRevenue += matchRevenue;
      history.unshift({
        id: `gate_${clubId}_${currentSeason}_w${currentWeek}`,
        season: currentSeason,
        week: currentWeek,
        amount: matchRevenue,
        category: "ticket_sales",
        description: `Matchday gate receipts (${att.toLocaleString()} attendance)`,
      });
    }

    // 3. Weekly commercial baseline (sponsorship, retail)
    const commercialIncome = club.competitionId === "super-league"
      ? (club.reputation * 3000)
      : (club.reputation * 1200);

    balance += commercialIncome;
    seasonRevenue += commercialIncome;
    history.unshift({
      id: `comm_${clubId}_${currentSeason}_w${currentWeek}`,
      season: currentSeason,
      week: currentWeek,
      amount: commercialIncome,
      category: "misc",
      description: "Commercial sponsorship and merchandising",
    });

    updatedFinances[clubId] = {
      ...club.finances,
      balance,
      seasonExpenses,
      seasonRevenue,
      history: history.slice(0, 50), // keep latest 50 transactions
    };
  }

  return updatedFinances;
}
