/**
 * Probe: transfer windows, recently-signed protection, and free-agent quality after rollover.
 */
import {
  initializeManagerDatabase,
  rolloverSeason,
  submitTransferBid,
  signFreeAgent,
  forceRetainAiExpiringContracts,
  isTransferWindowOpen,
  describeTransferWindow,
  isRecentlySignedPlayer,
  TRANSFER_WINDOWS,
  TRANSFER_PROTECTION,
  calculateMarketWage,
} from "../src/lib/manager";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function countQualityFreeAgents(state: ReturnType<typeof initializeManagerDatabase>, minRating: number) {
  return Object.values(state.players).filter(
    (p) => p.clubId === null && !p.isRetired && p.rating >= minRating
  ).length;
}

function main() {
  console.log("=== Transfer windows / FA probe ===\n");

  let state = initializeManagerDatabase("wigan-warriors", "Probe Coach");
  const userId = state.manager.clubId;

  // 1. Window schedule
  for (const week of [1, 8, 9, 17, 18, 22, 23, 24, 32]) {
    const info = describeTransferWindow(week);
    console.log(`Week ${week}: open=${isTransferWindowOpen(week)} — ${info.label}`);
  }
  assert(isTransferWindowOpen(1), "summer open week 1");
  assert(isTransferWindowOpen(8), "summer open week 8");
  assert(!isTransferWindowOpen(9), "closed week 9");
  assert(isTransferWindowOpen(18), "winter open week 18");
  assert(!isTransferWindowOpen(23), "closed week 23");

  // 2. Seed FA quality should not include elites
  const seedEliteFas = countQualityFreeAgents(state, 75);
  console.log(`\nSeed FAs rated 75+: ${seedEliteFas}`);
  assert(seedEliteFas === 0, "seed free agents must stay below 75 OVR");

  // 3. Closed-window bid rejected
  state = { ...state, calendar: { ...state.calendar, currentWeek: 12 } };
  const marketTarget = Object.values(state.players).find(
    (p) => p.clubId && p.clubId !== userId && p.rating >= 70 && !p.loan
  );
  assert(marketTarget, "need a market target");
  const closedBid = submitTransferBid(
    state,
    userId,
    marketTarget!.id,
    50_000,
    1000,
    "first_team",
    2
  );
  assert(!closedBid.success, "bid must fail outside window");
  console.log(`Closed-window bid error: ${closedBid.error}`);

  // 4. Recently-signed protection
  state = { ...state, calendar: { ...state.calendar, currentWeek: 3 } };
  const fa = Object.values(state.players).find((p) => p.clubId === null && !p.isRetired);
  assert(fa, "need a free agent");
  const wage = calculateMarketWage(fa!.rating, fa!.age, state.clubs[userId].competitionId);
  const signed = signFreeAgent(state, userId, fa!.id, wage, 2, "rotation");
  assert(signed.success, `FA sign failed: ${signed.error}`);
  state = signed.state;
  const signedPlayer = state.players[fa!.id];
  assert(
    isRecentlySignedPlayer(signedPlayer, state.calendar.currentSeason, state.calendar.currentWeek),
    "fresh signing should be protected"
  );

  // AI club tries to bid for the newly signed user player
  const aiClub = Object.keys(state.clubs).find((id) => id !== userId)!;
  const poach = submitTransferBid(
    state,
    aiClub,
    signedPlayer.id,
    80_000,
    wage,
    "first_team",
    2,
    { silent: true }
  );
  assert(!poach.success, "recently signed user player must be protected from bids");
  console.log(`Protection error: ${poach.error}`);
  assert(
    poach.error?.includes(String(TRANSFER_PROTECTION.RECENT_SIGNING_WEEKS)),
    "error should mention protection weeks"
  );

  // 5. Advance through a season + rollover; measure quality FA dump
  state = initializeManagerDatabase("wigan-warriors", "Probe Coach");
  // Force many AI contracts to expire this season so retention is exercised
  {
    const patched = { ...state.players };
    for (const p of Object.values(patched)) {
      if (
        p.clubId &&
        p.clubId !== state.manager.clubId &&
        p.contract &&
        p.rating >= 72
      ) {
        patched[p.id] = {
          ...p,
          contract: { ...p.contract, expiresSeason: state.calendar.currentSeason },
        };
      }
    }
    state = { ...state, players: patched };
  }

  const beforeRetain = countQualityFreeAgents(state, 75);
  void beforeRetain;
  state = forceRetainAiExpiringContracts(state, state.calendar.currentSeason);
  const stillExpiring75 = Object.values(state.players).filter(
    (p) =>
      p.clubId &&
      p.clubId !== state.manager.clubId &&
      p.contract &&
      p.contract.expiresSeason <= state.calendar.currentSeason &&
      p.rating >= 75
  ).length;
  console.log(`\nAfter forceRetain, AI 75+ still expiring: ${stillExpiring75}`);
  assert(stillExpiring75 === 0, "forceRetain must keep AI 75+ under contract");

  // Run to season end via phase jump for speed
  state = {
    ...state,
    calendar: {
      ...state.calendar,
      currentWeek: state.calendar.totalWeeks,
      phase: "season_end",
    },
  };
  const rolled = rolloverSeason(state);
  state = rolled.state;

  const fa75 = countQualityFreeAgents(state, 75);
  const fa78 = countQualityFreeAgents(state, 78);
  const fa82 = countQualityFreeAgents(state, 82);
  console.log(`Post-rollover FAs — 75+: ${fa75}, 78+: ${fa78}, 82+: ${fa82}`);
  assert(fa82 === 0, "no 82+ free agents after rollover retention");
  assert(fa78 <= 3, `too many 78+ free agents after rollover (${fa78})`);
  assert(fa75 <= 12, `too many 75+ free agents after rollover (${fa75})`);

  console.log("\nWindow constants:", TRANSFER_WINDOWS);
  console.log("Protection weeks:", TRANSFER_PROTECTION.RECENT_SIGNING_WEEKS);
  console.log("\nALL CHECKS PASSED");
}

main();
