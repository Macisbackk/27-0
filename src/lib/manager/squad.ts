/**
 * Squad management and invariant validation.
 * Pure simulation logic.
 */

import { buildBestLineup } from "./database";
import { STARTING_POSITIONS } from "./rules";
import type {
  ClubLineup,
  ManagerState,
  SquadTier,
} from "./types";

export interface SquadOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
}

/**
 * Moves a player between First Team, Reserves, and Academy tiers.
 * Enforces single-tier invariant and auto-cleans lineup slots.
 */
export function movePlayerTier(
  state: ManagerState,
  playerId: string,
  targetTier: SquadTier
): SquadOperationResult {
  const player = state.players[playerId];
  if (!player) {
    return { success: false, state, error: "Player not found." };
  }

  if (!player.clubId) {
    return { success: false, state, error: "Free agents do not belong to a squad tier." };
  }

  if (player.loan && player.loan.parentClubId === player.clubId) {
    return { success: false, state, error: "Cannot change squad tier of a player currently on loan." };
  }

  if (player.squadTier === targetTier) {
    return { success: true, state };
  }

  const updatedPlayer = {
    ...player,
    squadTier: targetTier,
  };

  const club = state.clubs[player.clubId];
  let updatedLineup = club ? { ...club.lineup } : undefined;

  // If moved out of first team, remove from lineup slots
  if (club && targetTier !== "first") {
    const starting13 = club.lineup.starting13.map(id => id === playerId ? null : id);
    const bench = club.lineup.bench.map(id => id === playerId ? null : id);
    updatedLineup = { starting13, bench };
  }

  const nextClubs = club && updatedLineup ? {
    ...state.clubs,
    [club.id]: {
      ...club,
      lineup: updatedLineup,
    },
  } : state.clubs;

  const nextState: ManagerState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    clubs: nextClubs,
  };

  return { success: true, state: nextState };
}

/**
 * Validates and sets a club's matchday lineup (starting 13 + 4 interchange).
 */
export function setClubLineup(
  state: ManagerState,
  clubId: string,
  lineup: ClubLineup
): SquadOperationResult {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, state, error: "Club not found." };
  }

  const selectedIds = [...lineup.starting13, ...lineup.bench].filter(Boolean) as string[];
  const seenIds = new Set<string>();

  // Invariant 1: No duplicate players across the 17 slots
  for (const id of selectedIds) {
    if (seenIds.has(id)) {
      const p = state.players[id];
      return {
        success: false,
        state,
        error: `Cannot select ${p?.name || id} in multiple positions.`,
      };
    }
    seenIds.add(id);
  }

  // Invariant 2: Players must belong to this club (or be on active loan to this club)
  for (const id of selectedIds) {
    const p = state.players[id];
    if (!p) {
      return { success: false, state, error: `Invalid player in lineup: ${id}` };
    }

    const isDirectMember = p.clubId === clubId;
    const isLoanedIn = p.loan && p.loan.destinationClubId === clubId;
    if (!isDirectMember && !isLoanedIn) {
      return {
        success: false,
        state,
        error: `${p.name} does not belong to ${club.name}.`,
      };
    }

    // Invariant 3: Unavailable players (injured or suspended) cannot be selected
    if (p.injury) {
      return {
        success: false,
        state,
        error: `${p.name} is injured (${p.injury.type}, ${p.injury.weeksRemaining} wk remaining) and cannot be selected.`,
      };
    }

    if (p.suspension) {
      return {
        success: false,
        state,
        error: `${p.name} is suspended (${p.suspension.reason}, ${p.suspension.weeksRemaining} wk remaining) and cannot be selected.`,
      };
    }
  }

  const nextState: ManagerState = {
    ...state,
    clubs: {
      ...state.clubs,
      [clubId]: {
        ...club,
        lineup,
      },
    },
  };

  return { success: true, state: nextState };
}

/**
 * Automatically picks the best available 17-man lineup for a club.
 */
export function autoPickClubLineup(
  state: ManagerState,
  clubId: string
): SquadOperationResult {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, state, error: "Club not found." };
  }

  const clubPlayers = Object.values(state.players).filter(
    (p) =>
      (p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
      (p.loan && p.loan.destinationClubId === clubId)
  );

  const bestLineup = buildBestLineup(clubPlayers);
  return setClubLineup(state, clubId, bestLineup);
}

/**
 * Authoritative invariant checker for the entire Manager Mode game world.
 * Detects orphaned players, dual club ownership, tier corruption, ghost contracts.
 */
export function validateSquadInvariants(state: ManagerState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const clubIds = new Set(Object.keys(state.clubs));

  for (const [id, player] of Object.entries(state.players)) {
    if (player.id !== id) {
      errors.push(`Player key mismatch: map key "${id}" vs player.id "${player.id}"`);
    }

    // Free agent rules
    if (player.clubId === null) {
      if (player.squadTier !== null) {
        errors.push(`Free agent ${player.name} (${id}) has non-null squadTier: ${player.squadTier}`);
      }
      if (player.contract !== null) {
        errors.push(`Free agent ${player.name} (${id}) has active contract.`);
      }
      if (player.loan !== null) {
        errors.push(`Free agent ${player.name} (${id}) has active loan.`);
      }
    } else {
      // Club member rules
      if (!clubIds.has(player.clubId)) {
        errors.push(`Player ${player.name} (${id}) belongs to non-existent club: ${player.clubId}`);
      }
      if (!["first", "reserves", "academy"].includes(player.squadTier as string)) {
        errors.push(`Player ${player.name} (${id}) has invalid squadTier: ${player.squadTier}`);
      }
      if (!player.contract) {
        errors.push(`Club player ${player.name} (${id}) has missing contract.`);
      }
    }

    // Loan rules
    if (player.loan) {
      if (!clubIds.has(player.loan.parentClubId)) {
        errors.push(`Loan for ${player.name} has invalid parent club: ${player.loan.parentClubId}`);
      }
      if (!clubIds.has(player.loan.destinationClubId)) {
        errors.push(`Loan for ${player.name} has invalid destination club: ${player.loan.destinationClubId}`);
      }
      if (player.loan.parentClubId === player.loan.destinationClubId) {
        errors.push(`Loan for ${player.name} has identical parent and destination.`);
      }
    }
  }

  // Club lineups check
  for (const [clubId, club] of Object.entries(state.clubs)) {
    const selected = [...club.lineup.starting13, ...club.lineup.bench].filter(Boolean) as string[];
    const seen = new Set<string>();
    for (const pid of selected) {
      if (seen.has(pid)) {
        errors.push(`Club ${club.name} has duplicate player ${pid} in matchday lineup.`);
      }
      seen.add(pid);

      const p = state.players[pid];
      if (!p) {
        errors.push(`Club ${club.name} has unknown player ID ${pid} in lineup.`);
      } else if (p.injury) {
        errors.push(`Club ${club.name} has injured player ${p.name} in lineup.`);
      } else if (p.suspension) {
        errors.push(`Club ${club.name} has suspended player ${p.name} in lineup.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sweeps all clubs in the universe to ensure no injured, suspended, or
 * transferred players remain in matchday lineups. Automatically fills empty
 * slots from available reserves so teams remain competitive.
 */
export function cleanAllClubLineups(state: ManagerState): ManagerState {
  const updatedClubs = { ...state.clubs };
  let modified = false;

  for (const [clubId, club] of Object.entries(state.clubs)) {
    const starting13 = [...club.lineup.starting13];
    const bench = [...club.lineup.bench];
    let clubModified = false;

    // 1. Identify invalid selections
    const selectedIds = new Set<string>();

    for (let i = 0; i < starting13.length; i++) {
      const pid = starting13[i];
      if (pid) {
        const p = state.players[pid];
        const isEligible =
          p &&
          !p.injury &&
          !p.suspension &&
          (p.clubId === clubId || p.loan?.destinationClubId === clubId);

        if (!isEligible || selectedIds.has(pid)) {
          starting13[i] = null;
          clubModified = true;
        } else {
          selectedIds.add(pid);
        }
      }
    }

    for (let i = 0; i < bench.length; i++) {
      const pid = bench[i];
      if (pid) {
        const p = state.players[pid];
        const isEligible =
          p &&
          !p.injury &&
          !p.suspension &&
          (p.clubId === clubId || p.loan?.destinationClubId === clubId);

        if (!isEligible || selectedIds.has(pid)) {
          bench[i] = null;
          clubModified = true;
        } else {
          selectedIds.add(pid);
        }
      }
    }

    // 2. If any slots are null, fill from available club players
    const availableBackups = Object.values(state.players)
      .filter(
        (p) =>
          (p.clubId === clubId || p.loan?.destinationClubId === clubId) &&
          !p.injury &&
          !p.suspension &&
          !selectedIds.has(p.id)
      )
      .sort((a, b) => b.rating - a.rating);

    let backupIdx = 0;
    for (let i = 0; i < starting13.length; i++) {
      if (starting13[i] === null && backupIdx < availableBackups.length) {
        starting13[i] = availableBackups[backupIdx].id;
        selectedIds.add(availableBackups[backupIdx].id);
        backupIdx++;
        clubModified = true;
      }
    }

    for (let i = 0; i < bench.length; i++) {
      if (bench[i] === null && backupIdx < availableBackups.length) {
        bench[i] = availableBackups[backupIdx].id;
        selectedIds.add(availableBackups[backupIdx].id);
        backupIdx++;
        clubModified = true;
      }
    }

    if (clubModified) {
      updatedClubs[clubId] = {
        ...club,
        lineup: { starting13, bench },
      };
      modified = true;
    }
  }

  return modified ? { ...state, clubs: updatedClubs } : state;
}
