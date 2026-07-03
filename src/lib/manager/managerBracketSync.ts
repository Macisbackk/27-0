import type { ManagerCareer } from "./types";
import { ensureCupBracketReady } from "./managerChallengeCup";
import { ensurePlayoffsReady } from "./managerPlayoffs";

/** Advance cup/playoff bracket sim and return updated career (no-op if unchanged). */
export function syncBracketProgress(career: ManagerCareer): ManagerCareer {
  return ensurePlayoffsReady(ensureCupBracketReady(career));
}

function cupProgressSignature(career: ManagerCareer): string {
  const cup = career.challengeCup;
  if (!cup) return "";
  const complete = cup.matches.filter((m) => m.status === "complete").length;
  return `${cup.userEliminated}|${cup.tournamentComplete}|${cup.userWon}|${complete}|${cup.matches.length}`;
}

function playoffProgressSignature(career: ManagerCareer): string {
  const playoffs = career.playoffs;
  if (!playoffs) return "";
  const complete = playoffs.matches.filter((m) => m.status === "complete").length;
  return `${playoffs.userEliminated}|${playoffs.tournamentComplete}|${playoffs.finish ?? ""}|${complete}|${playoffs.matches.length}`;
}

export function bracketProgressChanged(
  before: ManagerCareer,
  after: ManagerCareer
): boolean {
  return (
    cupProgressSignature(before) !== cupProgressSignature(after) ||
    playoffProgressSignature(before) !== playoffProgressSignature(after)
  );
}
