import type { ManagerCareer } from "./types";
import {
  advanceManagerMatchWeek,
  getNextManagerFixture,
  isManagerSeasonComplete,
  prepareCareerForNextMatch,
  simulateManagerNextMatch,
} from "./managerSimulation";
import { autoFixMatchdaySquad } from "./managerAutoFix";
import { validateFitMatchdaySquad } from "./managerMatchdayValidation";
import {
  getMatchWeekPhase,
  hasBlockingManagerDecision,
} from "./managerMatchWeek";
import { autoSelectFriendlyForSim } from "./managerFriendlies";

export interface SimToDateResult {
  ok: boolean;
  career: ManagerCareer;
  matchesSimulated: number;
  weeksAdvanced: number;
  error?: string;
  /** True when a blocking popup / season end stopped early. */
  stoppedEarly?: boolean;
  /** Season finished during the sim — host should open review/celebrations. */
  seasonComplete?: boolean;
}

const MAX_STEPS = 140;

/**
 * Auto-simulate user matches and advance Match Weeks until `career.gameWeek`
 * reaches `targetGameWeek` (inclusive of fixtures through that week).
 */
export function simulateCareerToGameWeek(
  career: ManagerCareer,
  targetGameWeek: number
): SimToDateResult {
  let next = {
    ...career,
    isSeasonComplete: isManagerSeasonComplete(career),
  };
  let matchesSimulated = 0;
  let weeksAdvanced = 0;

  if (targetGameWeek <= next.gameWeek && next.matchWeekPhase !== "awaiting_advance") {
    return {
      ok: true,
      career: next,
      matchesSimulated: 0,
      weeksAdvanced: 0,
      error: "Already at or past that date.",
    };
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    if (next.isSeasonComplete || isManagerSeasonComplete(next)) {
      next = { ...next, isSeasonComplete: true };
      return {
        ok: true,
        career: next,
        matchesSimulated,
        weeksAdvanced,
        stoppedEarly: true,
        seasonComplete: true,
        error: "Season complete.",
      };
    }

    if (hasBlockingManagerDecision(next)) {
      return {
        ok: true,
        career: next,
        matchesSimulated,
        weeksAdvanced,
        stoppedEarly: true,
        error: "Resolve pending decisions first.",
      };
    }

    const phase = getMatchWeekPhase(next);

    if (phase === "awaiting_advance") {
      if (next.gameWeek >= targetGameWeek) {
        return {
          ok: true,
          career: next,
          matchesSimulated,
          weeksAdvanced,
        };
      }
      const advanced = advanceManagerMatchWeek(next);
      if (!advanced.ok) {
        return {
          ok: false,
          career: next,
          matchesSimulated,
          weeksAdvanced,
          stoppedEarly: true,
          error: advanced.error,
        };
      }
      next = {
        ...advanced.career,
        isSeasonComplete: isManagerSeasonComplete(advanced.career),
      };
      weeksAdvanced++;
      continue;
    }

    if (next.gameWeek >= targetGameWeek) {
      return {
        ok: true,
        career: next,
        matchesSimulated,
        weeksAdvanced,
      };
    }

    let ready = next;
    for (let friendlyStep = 0; friendlyStep < 8; friendlyStep++) {
      const autoFriendly = autoSelectFriendlyForSim(ready);
      ready = autoFriendly.career;
      if (getNextManagerFixture(prepareCareerForNextMatch(ready))) break;
      if (!autoFriendly.autoSelectedClub && !ready.preSeason.activeFriendly) {
        break;
      }
    }

    ready = prepareCareerForNextMatch(ready);
    if (ready.managerSettings?.autoFixSquadBeforeMatch !== false) {
      ready = autoFixMatchdaySquad(ready).career;
    }
    const check = validateFitMatchdaySquad(ready);
    if (!check.valid) {
      return {
        ok: false,
        career: next,
        matchesSimulated,
        weeksAdvanced,
        stoppedEarly: true,
        error: check.message || "Fix your matchday squad before simulating.",
      };
    }
    if (!getNextManagerFixture(ready)) {
      if (next.gameWeek >= targetGameWeek) {
        return {
          ok: true,
          career: next,
          matchesSimulated,
          weeksAdvanced,
        };
      }
      return {
        ok: false,
        career: next,
        matchesSimulated,
        weeksAdvanced,
        stoppedEarly: true,
        error: "No fixture available to simulate.",
      };
    }

    const sim = simulateManagerNextMatch(ready);
    if (!sim.ok) {
      return {
        ok: false,
        career: next,
        matchesSimulated,
        weeksAdvanced,
        stoppedEarly: true,
        error: sim.error,
      };
    }
    next = {
      ...sim.career,
      isSeasonComplete: isManagerSeasonComplete(sim.career),
    };
    matchesSimulated++;
  }

  return {
    ok: false,
    career: next,
    matchesSimulated,
    weeksAdvanced,
    stoppedEarly: true,
    error: "Stopped after too many steps — check pending decisions.",
  };
}
