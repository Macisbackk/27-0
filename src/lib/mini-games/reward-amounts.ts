/**
 * Daily mini-game Club Funds amounts. Kept dependency-free so lib/club-funds can import them
 * without a cycle (rewards.ts → storage/club-funds → club-funds).
 */
export const WORDLE_WIN_REWARD = 20_000;
export const HANGMAN_WIN_REWARD = 5_000;
export const HIGHER_LOWER_FIVE_REWARD = 2_500;
/** Rugby League Grid (daily only): paid per correct square, so a full 9/9 grid pays £22,500. */
export const GRID_REWARD_PER_CELL = 2_500;
