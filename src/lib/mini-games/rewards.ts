import { awardClubFundsLines } from "@/lib/storage/club-funds";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";

export {
  WORDLE_WIN_REWARD,
  HANGMAN_WIN_REWARD,
  HIGHER_LOWER_FIVE_REWARD,
} from "./reward-amounts";

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
