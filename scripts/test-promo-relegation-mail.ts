/**
 * Break / alignment tests for promotion, relegation, and RFL mail copy.
 * Ensures every bulletin names the clubs that actually moved.
 */
import { initializeManagerDatabase } from "../src/lib/manager/database";
import { advanceWeek } from "../src/lib/manager/advancement";
import {
  calculateSeasonAwards,
  rolloverSeason,
  buildRflSeasonReviewEmail,
  formatRflSeasonReviewFromBodyRecord,
  findChallengeCupFinal,
  isChallengeCupFinalRound,
  createSeasonHistoryRecord,
} from "../src/lib/manager/rollover";
import { sortStandings } from "../src/lib/manager/competitions";
import type { ManagerState } from "../src/lib/manager/types";

let testCount = 0;
let passedCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`✓ [PASS] ${message}`);
}

function advanceToWeek(state: ManagerState, week: number): ManagerState {
  let s = state;
  while (s.calendar.currentWeek < week) {
    s = advanceWeek(s);
  }
  return s;
}

function assertMailContains(body: string, needle: string, label: string) {
  assert(body.includes(needle), `${label} mentions "${needle}"`);
}

async function run() {
  console.log("\n========================================================");
  console.log("PROMOTION / RELEGATION / MAIL ALIGNMENT BREAK TESTS");
  console.log("========================================================\n");

  // --- Challenge Cup Final detector ---
  assert(isChallengeCupFinalRound("Challenge Cup Final"), "Exact CC Final matches");
  assert(!isChallengeCupFinalRound("Challenge Cup Quarter Final 1"), "Quarter Final rejected");
  assert(!isChallengeCupFinalRound("Challenge Cup Semi-Final 2"), "Semi-Final rejected");
  assert(!isChallengeCupFinalRound("Super League Grand Final"), "SL GF is not CC Final");

  let state = initializeManagerDatabase("castleford-tigers", "Align Tester");

  console.log("--- Advance to Week 29 (auto promo/relegation bulletin) ---");
  state = advanceToWeek(state, 29);

  const sl = sortStandings(state.competitions["super-league"].standings);
  const champ = sortStandings(state.competitions["championship"].standings);
  const autoPromotedId = champ[0].clubId;
  const autoRelegatedId = sl[13].clubId;
  const mpgSlId = sl[12].clubId;
  const autoPromotedName = state.clubs[autoPromotedId].name;
  const autoRelegatedName = state.clubs[autoRelegatedId].name;
  const mpgSlName = state.clubs[mpgSlId].name;

  const week29Mail = state.inbox.messages.find((m) =>
    m.subject.includes("Promoted to Super League")
  );
  assert(!!week29Mail, "Week 29 auto-promotion inbox mail exists");
  assertMailContains(week29Mail!.body, autoPromotedName, "Week 29 mail (champions)");
  assertMailContains(week29Mail!.body, autoRelegatedName, "Week 29 mail (14th)");
  assertMailContains(week29Mail!.body, mpgSlName, "Week 29 mail (13th / MPG)");
  assertMailContains(
    week29Mail!.subject,
    autoPromotedName,
    "Week 29 subject names promoted club"
  );

  console.log("--- Advance through playoffs to Week 32 (MPG scheduled) ---");
  state = advanceToWeek(state, 32);

  const mpg = state.competitions["super-league"].fixtures.find(
    (f) => f.roundName === "The Million Pound Game" && f.week === 32
  );
  assert(!!mpg, "MPG fixture scheduled");
  assert(mpg!.homeClubId === mpgSlId, "MPG home is 13th SL");
  assert(mpg!.awayClubId !== autoPromotedId, "MPG away is not auto-promoted champ");

  const playoffWinnerId = mpg!.awayClubId;
  const playoffWinnerName = state.clubs[playoffWinnerId].name;

  const mpgPreview = state.inbox.messages.find((m) =>
    m.subject.includes("THE MILLION POUND GAME")
  );
  assert(!!mpgPreview, "MPG preview mail exists");
  assertMailContains(mpgPreview!.body, mpgSlName, "MPG preview names SL 13th");
  assertMailContains(mpgPreview!.body, playoffWinnerName, "MPG preview names playoff winner");
  assert(
    mpgPreview!.subject.includes(mpgSlName) && mpgPreview!.subject.includes(playoffWinnerName),
    "MPG subject lists both clubs"
  );

  // --- Scenario A: Champ wins MPG ---
  console.log("--- Scenario A: Championship wins MPG ---");
  const stateA = JSON.parse(JSON.stringify(state)) as ManagerState;
  const mpgIdxA = stateA.competitions["super-league"].fixtures.findIndex(
    (f) => f.roundName === "The Million Pound Game"
  );
  stateA.competitions["super-league"].fixtures[mpgIdxA] = {
    ...stateA.competitions["super-league"].fixtures[mpgIdxA],
    isPlayed: true,
    homeScore: 10,
    awayScore: 22,
  };
  // Mirror champ copy if present
  const champMpgIdxA = stateA.competitions["championship"].fixtures.findIndex(
    (f) => f.roundName === "The Million Pound Game"
  );
  if (champMpgIdxA >= 0) {
    stateA.competitions["championship"].fixtures[champMpgIdxA] = {
      ...stateA.competitions["championship"].fixtures[champMpgIdxA],
      isPlayed: true,
      homeScore: 10,
      awayScore: 22,
    };
  }

  const awardsA = calculateSeasonAwards(stateA);
  assert(awardsA.autoPromotedClub === autoPromotedName, "Awards auto-promoted = Champ 1st name");
  assert(awardsA.autoRelegatedClub === autoRelegatedName, "Awards auto-relegated = SL 14th name");
  assert(awardsA.championshipChampion === autoPromotedName, "Championship champion = auto promoted");
  assert(awardsA.promotedClubIds.length === 2, "A: 2 clubs promoted");
  assert(awardsA.relegatedClubIds.length === 2, "A: 2 clubs relegated");
  assert(awardsA.promotedClubIds.includes(autoPromotedId), "A: auto promo in list");
  assert(awardsA.promotedClubIds.includes(playoffWinnerId), "A: MPG winner in promo list");
  assert(awardsA.relegatedClubIds.includes(autoRelegatedId), "A: auto relegated in list");
  assert(awardsA.relegatedClubIds.includes(mpgSlId), "A: SL 13th relegated via MPG");
  assert(awardsA.millionPoundGame?.superLeagueSurvived === false, "A: SL did not survive MPG");
  assert(
    awardsA.millionPoundGame?.championshipTeam === playoffWinnerName,
    "A: MPG championshipTeam name matches playoff winner"
  );
  assert(
    awardsA.millionPoundGame?.superLeagueTeam === mpgSlName,
    "A: MPG superLeagueTeam name matches 13th"
  );

  const emailA = buildRflSeasonReviewEmail(stateA.calendar.currentSeason, awardsA);
  assertMailContains(
    emailA.body,
    `Automatic Promotion to Super League: ${autoPromotedName}`,
    "RFL email A auto promo"
  );
  assertMailContains(
    emailA.body,
    `Automatic Relegation to Championship: ${autoRelegatedName}`,
    "RFL email A auto releg"
  );
  assertMailContains(emailA.body, playoffWinnerName, "RFL email A mentions MPG promoted club");
  assertMailContains(emailA.body, mpgSlName, "RFL email A mentions MPG relegated club");
  assert(
    emailA.body.includes(`Promoted to Super League: ${awardsA.promotedClubs.join(", ")}`),
    "RFL email A confirmed promo list matches awards"
  );
  assert(
    emailA.body.includes(`Relegated to Championship: ${awardsA.relegatedClubs.join(", ")}`),
    "RFL email A confirmed releg list matches awards"
  );
  assert(
    emailA.body.includes("achieve promotion to Super League"),
    "RFL email A MPG outcome = champ promoted"
  );
  assert(
    !emailA.body.includes("retained Super League status"),
    "RFL email A does not claim SL survival"
  );

  // Advance to 33 for post-MPG bulletin then rollover
  let stateAAdv = advanceWeek(stateA);
  assert(stateAAdv.calendar.currentWeek === 33, "A: advanced to week 33");
  const postMpgA = stateAAdv.inbox.messages.find((m) =>
    m.subject.includes("PROMOTED TO SUPER LEAGUE")
  );
  assert(!!postMpgA, "A: post-MPG promotion bulletin exists");
  assertMailContains(postMpgA!.body, playoffWinnerName, "A: post-MPG mail names promoted club");
  assertMailContains(postMpgA!.body, mpgSlName, "A: post-MPG mail names relegated SL club");
  assert(postMpgA!.subject.includes(playoffWinnerName), "A: post-MPG subject names winner");

  const { state: nextA, awards: rollAwardsA } = rolloverSeason(stateAAdv);
  assert(
    nextA.clubs[autoPromotedId].competitionId === "super-league",
    "A rollover: auto promo in SL"
  );
  assert(
    nextA.clubs[playoffWinnerId].competitionId === "super-league",
    "A rollover: MPG winner in SL"
  );
  assert(
    nextA.clubs[autoRelegatedId].competitionId === "championship",
    "A rollover: 14th in Champ"
  );
  assert(nextA.clubs[mpgSlId].competitionId === "championship", "A rollover: 13th in Champ");

  const reviewA = nextA.inbox.messages.find((m) =>
    m.subject.includes("Season Review & Roll of Honour")
  );
  assert(!!reviewA, "A: Season Review mail after rollover");
  assertMailContains(reviewA!.body, autoPromotedName, "A review: auto promo");
  assertMailContains(reviewA!.body, autoRelegatedName, "A review: auto releg");
  assertMailContains(reviewA!.body, playoffWinnerName, "A review: MPG promo");
  assertMailContains(reviewA!.body, mpgSlName, "A review: MPG releg");

  const histA = nextA.seasonHistory![nextA.seasonHistory!.length - 1];
  assert(histA.autoPromotedClub === autoPromotedName, "A history stores autoPromotedClub");
  assert(histA.autoRelegatedClub === autoRelegatedName, "A history stores autoRelegatedClub");
  assert(
    histA.championshipChampion === autoPromotedName,
    "A history championshipChampion aligned"
  );

  // Reconstruct email with deliberately scrambled promo order — auto line must stay Champ 1st
  const scrambled = {
    ...histA,
    promotedClubs: [playoffWinnerName, autoPromotedName],
    relegatedClubs: [mpgSlName, autoRelegatedName],
  };
  const reconstructed = formatRflSeasonReviewFromBodyRecord(scrambled);
  assert(
    reconstructed.includes(
      `Automatic Promotion to Super League: ${autoPromotedName} (Championship Champions)`
    ),
    "Reconstructed mail uses championship champion for auto promo, not MPG winner"
  );
  assert(
    reconstructed.includes(
      `Automatic Relegation to Championship: ${autoRelegatedName} (Super League 14th Place)`
    ),
    "Reconstructed mail uses auto-relegated 14th, not MPG loser"
  );

  // --- Scenario B: SL survives MPG ---
  console.log("--- Scenario B: Super League survives MPG ---");
  const stateB = JSON.parse(JSON.stringify(state)) as ManagerState;
  const mpgIdxB = stateB.competitions["super-league"].fixtures.findIndex(
    (f) => f.roundName === "The Million Pound Game"
  );
  stateB.competitions["super-league"].fixtures[mpgIdxB] = {
    ...stateB.competitions["super-league"].fixtures[mpgIdxB],
    isPlayed: true,
    homeScore: 28,
    awayScore: 12,
  };
  const awardsB = calculateSeasonAwards(stateB);
  assert(awardsB.promotedClubIds.length === 1, "B: exactly 1 promoted");
  assert(awardsB.relegatedClubIds.length === 1, "B: exactly 1 relegated");
  assert(awardsB.promotedClubIds[0] === autoPromotedId, "B: only auto promo");
  assert(awardsB.relegatedClubIds[0] === autoRelegatedId, "B: only auto releg");
  assert(!awardsB.promotedClubIds.includes(playoffWinnerId), "B: playoff winner NOT promoted");
  assert(!awardsB.relegatedClubIds.includes(mpgSlId), "B: 13th SL survives");
  assert(awardsB.millionPoundGame?.superLeagueSurvived === true, "B: SL survived flag");

  const emailB = buildRflSeasonReviewEmail(stateB.calendar.currentSeason, awardsB);
  assert(emailB.body.includes("retained Super League status"), "B email: SL survival wording");
  assert(
    emailB.body.includes(`${playoffWinnerName} remain in the Championship`),
    "B email: champ stay down wording"
  );
  assert(
    !emailB.body.includes(`${playoffWinnerName} defeated`),
    "B email: does not claim champ defeated SL"
  );

  let stateBAdv = advanceWeek(stateB);
  const postMpgB = stateBAdv.inbox.messages.find((m) => m.subject.includes("SURVIVE"));
  assert(!!postMpgB, "B: survival bulletin exists");
  assertMailContains(postMpgB!.body, mpgSlName, "B: survival mail names SL club");
  assertMailContains(postMpgB!.body, playoffWinnerName, "B: survival mail names champ club");

  const { state: nextB } = rolloverSeason(stateBAdv);
  assert(nextB.clubs[mpgSlId].competitionId === "super-league", "B rollover: 13th stays SL");
  assert(
    nextB.clubs[playoffWinnerId].competitionId === "championship",
    "B rollover: playoff winner stays Champ"
  );
  assert(
    Object.values(nextB.clubs).filter((c) => c.competitionId === "super-league").length === 14,
    "B: still 14 SL clubs"
  );
  assert(
    Object.values(nextB.clubs).filter((c) => c.competitionId === "championship").length === 14,
    "B: still 14 Champ clubs"
  );

  // --- Challenge Cup Final must not be QF ---
  console.log("--- Challenge Cup Final detection ---");
  const ccState = initializeManagerDatabase("wigan-warriors", "Cup Align");
  const season = ccState.calendar.currentSeason;
  const qfWinner = "wigan-warriors";
  const fakeQf = {
    id: "fake_qf",
    competitionId: "challenge-cup" as const,
    season,
    week: 16,
    roundName: "Challenge Cup Quarter Final 1",
    homeClubId: qfWinner,
    awayClubId: "st-helens",
    isPlayed: true,
    homeScore: 40,
    awayScore: 0,
  };
  const fakeFinal = {
    id: "fake_final",
    competitionId: "challenge-cup" as const,
    season,
    week: 28,
    roundName: "Challenge Cup Final",
    homeClubId: "leeds-rhinos",
    awayClubId: "warrington-wolves",
    isPlayed: true,
    homeScore: 16,
    awayScore: 10,
  };
  const cupState: ManagerState = {
    ...ccState,
    competitions: {
      ...ccState.competitions,
      "challenge-cup": {
        ...ccState.competitions["challenge-cup"],
        fixtures: [fakeQf, fakeFinal, ...ccState.competitions["challenge-cup"].fixtures],
      },
    },
  };
  const foundFinal = findChallengeCupFinal(
    cupState.competitions["challenge-cup"].fixtures,
    season
  );
  assert(foundFinal?.id === "fake_final", "findChallengeCupFinal skips Quarter Final");
  const cupAwards = calculateSeasonAwards(cupState);
  assert(
    cupAwards.challengeCupWinner === "Leeds Rhinos",
    `CC winner is Final winner not QF (got ${cupAwards.challengeCupWinner})`
  );
  const { record: cupRecord } = createSeasonHistoryRecord(cupState, cupAwards);
  assert(
    cupRecord.challengeCupWinner === "Leeds Rhinos",
    "History CC winner is Final winner"
  );

  console.log("\n========================================================");
  console.log(`ALL ALIGNMENT TESTS PASSED: ${passedCount} / ${testCount}`);
  console.log("========================================================\n");
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
