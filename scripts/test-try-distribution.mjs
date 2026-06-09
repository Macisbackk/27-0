import seedrandom from "seedrandom";

// Inline caps logic from season-tries.ts
const POSITION_TRY_WEIGHT = {
  WING: 10, CENTRE: 7, FULLBACK: 6, STAND_OFF: 3.5, SCRUM_HALF: 2.5,
  LOOSE_FORWARD: 1.8, SECOND_ROW: 1.4, HOOKER: 1, PROP: 0.6,
};
const POSITION_SHARE_MAX = {
  WING: 0.28, CENTRE: 0.18, FULLBACK: 0.18, STAND_OFF: 0.14, SCRUM_HALF: 0.12,
  HOOKER: 0.1, SECOND_ROW: 0.1, LOOSE_FORWARD: 0.08, PROP: 0.05,
};

function getMaxIndividualTries(seasonWins, seasonTries) {
  if (seasonWins <= 6) return Math.min(14, Math.max(6, Math.ceil(seasonTries * 0.26)));
  if (seasonWins <= 14) return Math.min(20, Math.max(10, Math.ceil(seasonTries * 0.28)));
  if (seasonWins <= 22) return Math.min(28, Math.max(14, Math.ceil(seasonTries * 0.3)));
  return Math.min(35, Math.max(18, Math.ceil(seasonTries * 0.32)));
}

// Simulate weak season: 3 wins, ~45 season tries (realistic for poor team)
const seasonWins = 3;
const seasonTries = 42;
const maxInd = getMaxIndividualTries(seasonWins, seasonTries);

console.log(`Weak team (3-25): season tries=${seasonTries}, max individual cap=${maxInd}`);
console.log(maxInd <= 15 ? "PASS: max individual within weak team range" : "FAIL: max too high");

const wingMax = Math.ceil(seasonTries * POSITION_SHARE_MAX.WING);
console.log(`Wing share cap: ${wingMax} tries (${Math.round(POSITION_SHARE_MAX.WING*100)}%)`);
console.log(wingMax <= 15 ? "PASS: wing cap realistic for weak team" : "FAIL: wing cap too high");
