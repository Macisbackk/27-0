/** Shared league-select / club-select star tier blurbs (no league runtime deps). */

export const MANAGER_STAR_TIER_BIOS: Record<number, string> = {
  5: "Win the title — Grand Final favourites",
  4: "Push for the top — challenge the leading pack",
  3: "Make the play-offs — finish in the top six",
  2: "Mid-table finish — solid Super League campaign",
  1: "Survive — stay clear of the bottom places",
};

/**
 * Championship stars are a separate ladder (max 3★).
 * A Championship 3★ is still below a Super League 3★ in absolute prestige.
 */
export const CHAMPIONSHIP_STAR_TIER_BIOS: Record<number, string> = {
  3: "Championship elite — win the title / push for Super League promotion",
  2: "Established Championship side — push for a top-four promotion push",
  1: "Building club — mid-table or survival; grow toward the promotion race",
};
