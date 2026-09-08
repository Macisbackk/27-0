import { awardClubFundsLines } from "@/lib/storage/club-funds";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";

export const WORDLE_WIN_REWARD = 8_000;
export const HANGMAN_WIN_REWARD = 5_000;
export const HIGHER_LOWER_FIVE_REWARD = 2_500;
export const HIGHER_LOWER_TEN_REWARD = 5_000;

export function claimMiniGameReward(
  runId: string,
  label: string,
  amount: number
): ClubFundsPayoutResult {
  return awardClubFundsLines(runId, [
    {
      id: "mini-game-reward",
      label,
      amount,
    },
  ]);
}
