import type { ChallengeCupResult, CupFinish } from "./challenge-cup-simulation";

const WINNER_LINES = [
  "A memorable cup run ends with silverware and a place in club folklore.",
  "A Wembley-worthy performance throughout the tournament.",
  "A cup campaign that supporters will remember for years.",
  "Knockout rugby league at its finest — the trophy is coming home.",
  "A famous Challenge Cup triumph built on big-match mentality.",
];

const FINAL_DEFEAT_LINES = [
  "The dream survived until the final, but the trophy slipped away at the last hurdle.",
  "So close to glory — a heartbreaking defeat on the biggest stage.",
  "A magnificent run that ended one result short of silverware.",
  "Wembley heartache after a campaign that deserved more.",
  "The final proved a step too far despite a heroic tournament effort.",
];

const SEMI_LINES = [
  "A strong tournament run that came up just short of the big stage.",
  "The cup dream faded at the semi-final — a campaign to be proud of nonetheless.",
  "Brave effort in the last four, but Wembley remained out of reach.",
  "Knocked out one round from the final after a stirring cup journey.",
];

const QUARTER_LINES = [
  "A promising cup campaign ended before momentum could build.",
  "The knockout journey stopped in the quarter-finals.",
  "A respectable run, but the tournament ended before the deep stages.",
  "Eliminated in the last eight after flashes of promise.",
];

const EARLY_LINES = [
  "A disappointing tournament that never really got going.",
  "An early exit — knocked out before the cup run could gather pace.",
  "The campaign ended abruptly in the opening knockout round.",
  "A frustrating cup outing that failed to spark into life.",
];

export function getChallengeCupCommentary(result: ChallengeCupResult): string {
  const pool = getCommentaryPool(result.finish);
  const idx =
    (result.matchesPlayed + result.wins * 3 + result.losses) % pool.length;
  return pool[idx];
}

function getCommentaryPool(finish: CupFinish): string[] {
  switch (finish) {
    case "Winners":
      return WINNER_LINES;
    case "Runners-Up":
      return FINAL_DEFEAT_LINES;
    case "Semi Final":
      return SEMI_LINES;
    case "Quarter Final":
      return QUARTER_LINES;
    default:
      return EARLY_LINES;
  }
}
