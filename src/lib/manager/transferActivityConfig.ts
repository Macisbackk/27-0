/**
 * Centralised tuning knobs for AI-driven transfer market activity.
 *
 * There is no explicit "transfer window" system in manager mode, so
 * `gameWeekActivityMultiplier` stands in for one: early season is treated as
 * the busiest trading period (pre-season business + early-season panic
 * buys), the mid-season is quiet, and the run-in gets a smaller "deadline"
 * bump. Every generator below should multiply its base chance by this value
 * rather than hard-coding its own week bands.
 *
 * Calibration targets (world-wide "serious" activity per week — offers,
 * bids, and completed AI deals combined; not hard guarantees):
 *   · Quiet weeks (mid-season, heat ~0.55): 0–2
 *   · Normal active weeks (heat 1.0): 2–5
 *   · Busy window weeks (early/run-in, heat ≥1.2): 4–8
 */
export interface TransferTargetPoolConfig {
  /** Relative likelihood that each market pool is selected by AI recruitment. */
  weights: {
    seniorFirstTeam: number;
    seniorRotation: number;
    reserve: number;
    freeAgent: number;
    championshipElite: number;
  };
  /** Extra urgency applied to recruitment during the opening weeks. */
  earlySeasonMultiplier: number;
  earlySeasonThroughWeek: number;
  /** User senior-squad approaches are budgeted once per season in this range. */
  minSeniorApproachesPerSeason: number;
  maxSeniorApproachesPerSeason: number;
  /** Interest cannot repeatedly cycle through the same player or buying club. */
  playerCooldownWeeks: number;
  clubCooldownWeeks: number;
  /** Hard limits protect the inbox and prevent a single pool dominating activity. */
  maxSeniorApproachesPerWeek: number;
  maxPendingSeniorApproaches: number;
}

export interface TransferActivityConfig {
  transferTargetPool: TransferTargetPoolConfig;
  /** AI-vs-AI Super League roster shuffling (managerAiTransfers.ts). */
  aiInternalTransfers: {
    /** Chance per attempt in the club's first season (× gameWeekActivityMultiplier). */
    baseChancePerMatch: number;
    /** Chance per attempt from season two onwards, before the step ramp (× heat). */
    postFirstSeasonChance: number;
    /** Extra chance added per season after the first. */
    seasonChanceStep: number;
    /** Hard ceiling on any single attempt's chance. */
    maxChance: number;
  };
  /** Incoming bids for the user's *listed* players (managerTransferLeague.ts). */
  incomingOffers: {
    /** Base roll per listed player per week (× heat). */
    baseChance: number;
    /** Added once the club has completed at least one season. */
    seasonBoost: number;
  };
  /** Unsolicited approaches for the user's unlisted squad players. */
  unsolicitedOffers: {
    /** Year-one approach chance per week (× heat). */
    baseChance: number;
    /** Chance from season two onwards, before the per-season ramp (× heat). */
    seasonRampStart: number;
    /** Extra chance added per season after season two. */
    seasonRampStep: number;
    maxChance: number;
  };
  /** Elite Championship → Super League signings (championship/championshipAiTransfers.ts). */
  championshipEliteToSl: {
    /** Weekly scan roll (× heat); most weeks still produce nothing. */
    weeklyScanChance: number;
    maxTransfersPerSeason: number;
    /** Weeks before the same Championship player can be targeted again. */
    cooldownWeeks: number;
  };
  /** Championship clubs bidding for Super League reserve-squad players. */
  reserveToChampionship: {
    /** Per-club weekly scan chance (× heat); each club rolls independently. */
    baseWeeklyScanChance: number;
    /** Successful bids a single Championship club can land in one week. */
    maxRequestsPerClubPerWeek: number;
    /** Successful bids across all Championship clubs combined in one week. */
    maxWorldRequestsPerWeek: number;
    /** Soft season cap so the Championship doesn't strip every club's reserves. */
    maxSigningsPerSeason: number;
    /** Weeks before the same reserve can be targeted again after a deal. */
    cooldownWeeksPerPlayer: number;
    /** Weeks before the same Championship club can submit another request. */
    cooldownWeeksPerClub: number;
    /** Seasonal cap for requests made by one Championship club. */
    maxRequestsPerClubPerSeason: number;
    /** Eligible current-ability band — prefers fringe reserves, not SL starters. */
    minCaRating: number;
    maxCaRating: number;
    /** Chance an AI-controlled selling club accepts a fair offer outright. */
    aiSellerAcceptChance: number;
    /** Championship squads top out at this size before releasing the weakest player. */
    squadSizeLimit: number;
  };
  /** Multiplier applied to the chances above, keyed by simulated transfer-market heat. */
  gameWeekActivityMultiplier: (gameWeek: number) => number;
}

export const DEFAULT_TRANSFER_ACTIVITY_CONFIG: TransferActivityConfig = {
  transferTargetPool: {
    weights: {
      seniorFirstTeam: 0.3,
      seniorRotation: 0.4,
      reserve: 0.12,
      freeAgent: 0.1,
      championshipElite: 0.08,
    },
    earlySeasonMultiplier: 1.8,
    earlySeasonThroughWeek: 7,
    minSeniorApproachesPerSeason: 2,
    maxSeniorApproachesPerSeason: 5,
    playerCooldownWeeks: 10,
    clubCooldownWeeks: 3,
    maxSeniorApproachesPerWeek: 1,
    maxPendingSeniorApproaches: 2,
  },
  aiInternalTransfers: {
    baseChancePerMatch: 0.38,
    postFirstSeasonChance: 0.58,
    seasonChanceStep: 0.08,
    maxChance: 0.85,
  },
  incomingOffers: {
    baseChance: 0.18,
    seasonBoost: 0.1,
  },
  unsolicitedOffers: {
    baseChance: 0.09,
    seasonRampStart: 0.12,
    seasonRampStep: 0.025,
    maxChance: 0.2,
  },
  championshipEliteToSl: {
    weeklyScanChance: 0.26,
    maxTransfersPerSeason: 9,
    cooldownWeeks: 6,
  },
  reserveToChampionship: {
    baseWeeklyScanChance: 0.035,
    maxRequestsPerClubPerWeek: 1,
    maxWorldRequestsPerWeek: 2,
    maxSigningsPerSeason: 10,
    cooldownWeeksPerPlayer: 12,
    cooldownWeeksPerClub: 4,
    maxRequestsPerClubPerSeason: 2,
    minCaRating: 70,
    maxCaRating: 84,
    aiSellerAcceptChance: 0.58,
    squadSizeLimit: 25,
  },
  gameWeekActivityMultiplier: (gameWeek: number): number => {
    // No dedicated transfer-window system — approximate one with week bands.
    if (gameWeek <= 5) return 1.35; // pre-season / early-season rush
    if (gameWeek <= 15) return 1; // normal mid-season trickle
    if (gameWeek <= 25) return 0.55; // quiet spell before the run-in
    return 1.2; // run-in / "deadline" scramble
  },
};
