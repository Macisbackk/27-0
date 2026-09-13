/**
 * Squad management and invariant validation.
 * Pure simulation logic.
 */

import { buildBestLineup } from "./database";
import { STARTING_POSITIONS, MATCHDAY_RULES } from "./rules";
import type {
  ClubLineup,
  ManagerPlayer,
  ManagerState,
  SquadTier,
} from "./types";

export interface SquadOperationResult {
  success: boolean;
  state: ManagerState;
  error?: string;
}

export interface MatchdayLineupReadiness {
  ready: boolean;
  required: number;
  selectedCount: number;
  starterCount: number;
  benchCount: number;
  missingSlots: number;
  unavailableNames: string[];
  error?: string;
}

/**
 * True if the player can be named/played for this club right now.
 * Loaned-out players stay on the parent roster for contracts/cap but are
 * only available at the destination club until the loan ends.
 */
export function isPlayerAvailableForClub(
  player: ManagerPlayer,
  clubId: string
): boolean {
  if (player.loan) {
    return player.loan.destinationClubId === clubId;
  }
  return player.clubId === clubId;
}

/**
 * Counts eligible players currently named in a club's matchday 17.
 * Injured/suspended/departed players in slots do not count.
 */
export function getMatchdayLineupReadiness(
  state: ManagerState,
  clubId: string
): MatchdayLineupReadiness {
  const club = state.clubs[clubId];
  const required = MATCHDAY_RULES.SQUAD_SIZE;
  if (!club) {
    return {
      ready: false,
      required,
      selectedCount: 0,
      starterCount: 0,
      benchCount: 0,
      missingSlots: required,
      unavailableNames: [],
      error: "Club not found.",
    };
  }

  const unavailableNames: string[] = [];
  const countEligible = (ids: (string | null)[]) => {
    let count = 0;
    for (const id of ids) {
      if (!id) continue;
      const p = state.players[id];
      if (!p) {
        unavailableNames.push("Unknown player");
        continue;
      }
      const eligible =
        !p.injury && !p.suspension && isPlayerAvailableForClub(p, clubId);
      if (!eligible) {
        unavailableNames.push(p.name);
        continue;
      }
      count++;
    }
    return count;
  };

  const starterCount = countEligible(club.lineup.starting13);
  const benchCount = countEligible(club.lineup.bench);
  const selectedCount = starterCount + benchCount;
  const missingSlots = Math.max(0, required - selectedCount);
  const ready =
    starterCount === MATCHDAY_RULES.STARTERS &&
    benchCount === MATCHDAY_RULES.BENCH &&
    selectedCount === required;

  let error: string | undefined;
  if (!ready) {
    if (selectedCount < required) {
      error = `Matchday squad incomplete: ${selectedCount}/${required} players named (need ${MATCHDAY_RULES.STARTERS} starters and ${MATCHDAY_RULES.BENCH} interchange). Fill your lineup in Tactics before playing.`;
    } else if (starterCount < MATCHDAY_RULES.STARTERS) {
      error = `Starting 13 incomplete: ${starterCount}/${MATCHDAY_RULES.STARTERS} starters selected.`;
    } else if (benchCount < MATCHDAY_RULES.BENCH) {
      error = `Interchange incomplete: ${benchCount}/${MATCHDAY_RULES.BENCH} bench players selected.`;
    }
    if (unavailableNames.length > 0) {
      error = `${error || "Lineup issue."} Unavailable in lineup: ${unavailableNames.slice(0, 3).join(", ")}${unavailableNames.length > 3 ? "…" : ""}.`;
    }
  }

  return {
    ready,
    required,
    selectedCount,
    starterCount,
    benchCount,
    missingSlots,
    unavailableNames,
    error,
  };
}

/**
 * Safeguard: rebuilds a club's lineup to a full eligible 17 if short or invalid.
 * Prefer first-team / loaned-in, then reserves, then academy.
 */
export function safeguardClubMatchdayLineup(
  state: ManagerState,
  clubId: string
): ManagerState {
  const readiness = getMatchdayLineupReadiness(state, clubId);
  if (readiness.ready) return state;

  const club = state.clubs[clubId];
  if (!club) return state;

  const eligible = (p: ManagerPlayer) =>
    !p.injury && !p.suspension && isPlayerAvailableForClub(p, clubId);

  const firstAndLoans = Object.values(state.players).filter(
    (p) =>
      eligible(p) &&
      ((p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
        p.loan?.destinationClubId === clubId)
  );
  const reserves = Object.values(state.players).filter(
    (p) => eligible(p) && p.clubId === clubId && p.squadTier === "reserves" && !p.loan
  );
  const academy = Object.values(state.players).filter(
    (p) => eligible(p) && p.clubId === clubId && p.squadTier === "academy" && !p.loan
  );

  const pool = [...firstAndLoans, ...reserves, ...academy];
  if (pool.length < MATCHDAY_RULES.SQUAD_SIZE) {
    // Still try — buildBestLineup fills what it can; caller may still block user play
    const partial = buildBestLineup(pool);
    return {
      ...state,
      clubs: {
        ...state.clubs,
        [clubId]: { ...club, lineup: partial },
      },
    };
  }

  const lineup = buildBestLineup(pool);
  return {
    ...state,
    clubs: {
      ...state.clubs,
      [clubId]: { ...club, lineup },
    },
  };
}

/**
 * Safeguard every club to a legal matchday 17 before fixtures are simulated.
 * Pass `skipClubId` to leave the user manager's named squad untouched (they must fix it).
 */
export function safeguardAllClubMatchdayLineups(
  state: ManagerState,
  options?: { skipClubId?: string }
): ManagerState {
  const skipIds = options?.skipClubId ? [options.skipClubId] : [];
  let next = cleanAllClubLineups(state, { skipAutoFillClubIds: skipIds });
  for (const clubId of Object.keys(next.clubs)) {
    if (options?.skipClubId && clubId === options.skipClubId) continue;
    next = safeguardClubMatchdayLineup(next, clubId);
  }
  return next;
}

/**
 * User-facing gate: may this club advance into match week with its current lineup?
 * Does not auto-fix the user's lineup — they must complete Tactics themselves.
 */
export function canClubPlayMatchday(
  state: ManagerState,
  clubId: string
): { allowed: boolean; error?: string; readiness: MatchdayLineupReadiness } {
  const readiness = getMatchdayLineupReadiness(state, clubId);
  if (readiness.ready) {
    return { allowed: true, readiness };
  }
  return {
    allowed: false,
    error: readiness.error || `Need a full ${MATCHDAY_RULES.SQUAD_SIZE}-man matchday squad.`,
    readiness,
  };
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

  if (player.loan) {
    return { success: false, state, error: "Cannot change squad tier of a player currently on loan." };
  }

  if (player.squadTier === targetTier) {
    return { success: true, state };
  }

  const updatedPlayer = {
    ...player,
    squadTier: targetTier,
    // Promoting out of the academy permanently marks them as that club's graduate
    academyProductOfClubId:
      player.squadTier === "academy" && player.clubId
        ? player.clubId
        : player.academyProductOfClubId ?? null,
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

    if (!isPlayerAvailableForClub(p, clubId)) {
      return {
        success: false,
        state,
        error: p.loan
          ? `${p.name} is on loan and cannot be selected by ${club.name}.`
          : `${p.name} does not belong to ${club.name}.`,
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
 * Uses first team + loaned-in, then reserves, then academy (same pool as safeguard).
 */
export function autoPickClubLineup(
  state: ManagerState,
  clubId: string
): SquadOperationResult {
  const club = state.clubs[clubId];
  if (!club) {
    return { success: false, state, error: "Club not found." };
  }

  const eligible = (p: ManagerPlayer) =>
    !p.injury && !p.suspension && isPlayerAvailableForClub(p, clubId);

  const firstAndLoans = Object.values(state.players).filter(
    (p) =>
      eligible(p) &&
      ((p.clubId === clubId && p.squadTier === "first" && !p.loan) ||
        p.loan?.destinationClubId === clubId)
  );
  const reserves = Object.values(state.players).filter(
    (p) => eligible(p) && p.clubId === clubId && p.squadTier === "reserves" && !p.loan
  );
  const academy = Object.values(state.players).filter(
    (p) => eligible(p) && p.clubId === clubId && p.squadTier === "academy" && !p.loan
  );
  const clubPlayers = [...firstAndLoans, ...reserves, ...academy];

  if (clubPlayers.length < MATCHDAY_RULES.SQUAD_SIZE) {
    return {
      success: false,
      state,
      error: `Not enough available players for a full 17 (${clubPlayers.length}/${MATCHDAY_RULES.SQUAD_SIZE}).`,
    };
  }

  const bestLineup = buildBestLineup(clubPlayers);
  const result = setClubLineup(state, clubId, bestLineup);
  if (!result.success) return result;

  const readiness = getMatchdayLineupReadiness(result.state, clubId);
  if (!readiness.ready) {
    return {
      success: false,
      state: result.state,
      error: readiness.error || "Could not fill a complete matchday 17.",
    };
  }
  return result;
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
 *
 * Pass `skipAutoFillClubIds` to remove invalid names without auto-completing
 * those clubs to 17 (used so the user must finish their own matchday 17).
 */
export function cleanAllClubLineups(
  state: ManagerState,
  options?: { skipAutoFillClubIds?: string[] }
): ManagerState {
  const updatedClubs = { ...state.clubs };
  let modified = false;
  const skipFill = new Set(options?.skipAutoFillClubIds || []);

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
          isPlayerAvailableForClub(p, clubId);

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
          isPlayerAvailableForClub(p, clubId);

        if (!isEligible || selectedIds.has(pid)) {
          bench[i] = null;
          clubModified = true;
        } else {
          selectedIds.add(pid);
        }
      }
    }

    // 2. If any slots are null, fill from available club players (unless skipped)
    if (!skipFill.has(clubId)) {
      const availableBackups = Object.values(state.players)
        .filter(
          (p) =>
            isPlayerAvailableForClub(p, clubId) &&
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
