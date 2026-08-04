/**
 * Measure Challenge Cup AI sim: Super League vs Championship (post tier-offset fix).
 * Run: npx tsx scripts/measure-sl-vs-championship-cup.ts
 *
 * Mirrors simulateClubVsClub / cupAiWinProbability from challenge-cup-bracket.ts
 * (those helpers are not exported).
 */
import seedrandom from "seedrandom";
import {
  CHAMPIONSHIP_CLUB_NAMES,
  isChampionshipClubName,
} from "../src/lib/clubs/championship-clubs";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import {
  getClubBaseStrength,
  getClubStrength,
} from "../src/lib/game/club-strength";
import { pickDecisiveScorePair } from "../src/lib/game/rl-scores";
import { getWinnerLoserScoreBounds } from "../src/lib/game/score-gap";

const N = 2000;

/** Same as challenge-cup-bracket.ts cupAiWinProbability */
function cupAiWinProbability(
  homeStr: number,
  awayStr: number,
  homeAdvantage: number,
  crossTier: boolean
): number {
  const diff = homeStr + homeAdvantage - awayStr;
  const scale = crossTier ? 0.028 : 0.014;
  const floor = crossTier ? 0.06 : 0.12;
  const ceil = crossTier ? 0.94 : 0.88;
  return Math.max(floor, Math.min(ceil, 0.5 + diff * scale));
}

/** Same formula as simulateClubVsClub in challenge-cup-bracket.ts (not exported). */
function simulateClubVsClub(
  home: string,
  away: string,
  seed: string
): {
  homeScore: number;
  awayScore: number;
  winner: string;
  homeStr: number;
  awayStr: number;
} {
  const rng = seedrandom(`${seed}-ai-measure`);
  const homeStr = getClubStrength(home, rng);
  const awayStr = getClubStrength(away, rng);
  const homeAdvantage = 3;
  const crossTier =
    isChampionshipClubName(home) !== isChampionshipClubName(away);
  const homeWins =
    rng() < cupAiWinProbability(homeStr, awayStr, homeAdvantage, crossTier);

  const winnerStrength = homeWins ? homeStr + homeAdvantage : awayStr;
  const loserStrength = homeWins ? awayStr : homeStr + homeAdvantage;
  const ratingGap =
    Math.abs(winnerStrength - loserStrength) + (crossTier ? 8 : 0);
  const bounds = getWinnerLoserScoreBounds(ratingGap, rng);
  const { winner: winScore, loser: lossScore } = pickDecisiveScorePair(
    bounds.winnerMin,
    bounds.winnerMax,
    bounds.loserMin,
    bounds.loserMax,
    rng
  );
  const homeScore = homeWins ? winScore : lossScore;
  const awayScore = homeWins ? lossScore : winScore;

  return {
    homeScore,
    awayScore,
    winner: homeWins ? home : away,
    homeStr,
    awayStr,
  };
}

console.log("=== getClubBaseStrength ===");
for (const club of [
  "Wigan Warriors",
  "Bradford Bulls",
  "Wakefield Trinity",
]) {
  console.log(`  ${club}: ${getClubBaseStrength(club)}`);
}
const sampleChamp = CHAMPIONSHIP_CLUB_NAMES.slice(0, 5);
for (const club of sampleChamp) {
  console.log(`  ${club}: ${getClubBaseStrength(club)}`);
}
const champBases = CHAMPIONSHIP_CLUB_NAMES.map((c) => getClubBaseStrength(c));
console.log(
  `\nChampionship base range: ${Math.min(...champBases)}–${Math.max(...champBases)}`
);
console.log(
  `All Champ bases === 70? ${champBases.every((b) => b === 70)}`
);

const slClubs = getPlayableClubNames();
const champClubs = [...CHAMPIONSHIP_CLUB_NAMES];
const pickRng = seedrandom("sl-vs-champ-pairings");

let champWins = 0;
let sumSlScore = 0;
let sumChampScore = 0;
let sumGap = 0;
let upsetEligible = 0;
let upsetChampWins = 0;

for (let i = 0; i < N; i++) {
  const sl = slClubs[Math.floor(pickRng() * slClubs.length)]!;
  const champ = champClubs[Math.floor(pickRng() * champClubs.length)]!;
  const slHome = pickRng() < 0.5;
  const home = slHome ? sl : champ;
  const away = slHome ? champ : sl;

  const result = simulateClubVsClub(home, away, `measure-${i}`);
  const slStr = slHome ? result.homeStr : result.awayStr;
  const champStr = slHome ? result.awayStr : result.homeStr;
  const slScore = slHome ? result.homeScore : result.awayScore;
  const champScore = slHome ? result.awayScore : result.homeScore;

  sumSlScore += slScore;
  sumChampScore += champScore;
  sumGap += slStr - champStr;

  if (result.winner === champ) champWins++;

  const slBase = getClubBaseStrength(sl);
  if (slBase >= champStr + 8) {
    upsetEligible++;
    if (result.winner === champ) upsetChampWins++;
  }
}

console.log(`\n=== ${N} random SL vs Championship sims (post-fix) ===`);
console.log(
  `Championship win rate: ${((100 * champWins) / N).toFixed(2)}% (${champWins}/${N})`
);
console.log(`Average SL score: ${(sumSlScore / N).toFixed(2)}`);
console.log(`Average Champ score: ${(sumChampScore / N).toFixed(2)}`);
console.log(`Average rating gap (SL - Champ assigned): ${(sumGap / N).toFixed(2)}`);
console.log(
  `Upset rate (Champ wins when SL base >= Champ assigned + 8): ${
    upsetEligible === 0
      ? "n/a"
      : `${((100 * upsetChampWins) / upsetEligible).toFixed(2)}% (${upsetChampWins}/${upsetEligible})`
  }`
);
