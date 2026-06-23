import seedrandom from "seedrandom";
import { getGeneratedClubSquadStrength } from "./opponent-squad-strength";
import type { LeagueTableRow } from "./league-table";
import {
  DREAM_TEAM_NAME,
  calculateSquadStrength,
  simulateOneFixture,
  type MatchFixture,
  type MatchSimState,
} from "./season-simulation";
import {
  decomposeRLScore,
  pickRLScore,
  snapToRLScore,
} from "./rl-scores";
import { distributeSeasonTries, type PlayerTryTotal } from "./season-tries";
import type { SquadSlot } from "../types";

export const PLAYOFF_QUALIFIERS = 6;

export type PlayoffFinish =
  | "Missed Play-Offs"
  | "Eliminated in Eliminator"
  | "Eliminated in Semi-Final"
  | "Grand Final Runner-Up"
  | "Super League Champions";

export interface PlayoffRoundResult {
  round: "Eliminator" | "Semi Final" | "Grand Final";
  roundIndex: number;
  opponent: string;
  isHome: boolean;
  isNeutral: boolean;
  userPlayed: boolean;
  userWon: boolean | null;
  fixture: MatchFixture;
  backgroundFixtures: MatchFixture[];
}

export interface PlayoffResult {
  qualified: boolean;
  finish: PlayoffFinish;
  leaguePosition: number;
  rounds: PlayoffRoundResult[];
  userFixtures: MatchFixture[];
  wins: number;
  losses: number;
  isChampion: boolean;
  tryScorers: PlayerTryTotal[];
}

export function userQualifiedForPlayoffs(leaguePosition: number): boolean {
  return leaguePosition <= PLAYOFF_QUALIFIERS;
}

function teamAtPosition(
  table: LeagueTableRow[],
  position: number
): string {
  return (
    table.find((row) => row.position === position)?.team ??
    `Team ${position}`
  );
}

function simulateAiKnockout(
  home: string,
  away: string,
  seed: string,
  matchKey: string,
  round: number,
  homeAdvantage = 3
): { winner: string; loser: string; fixture: MatchFixture } {
  const rng = seedrandom(`${seed}-playoff-ai-${matchKey}`);
  const homeStr = getGeneratedClubSquadStrength(home, seed, "season") + homeAdvantage;
  const awayStr = getGeneratedClubSquadStrength(away, seed, "season");
  const homeWins = rng() < 0.5 + ((homeStr - awayStr) / 100) * 0.7;

  const winMin = 14;
  const winMax = 34;
  const lossMin = 0;
  const lossMax = 22;

  let homeScore = snapToRLScore(
    pickRLScore(homeWins ? winMin : lossMin, homeWins ? winMax : lossMax, rng),
    homeWins
  );
  let awayScore = snapToRLScore(
    pickRLScore(homeWins ? lossMin : winMin, homeWins ? lossMax : winMax, rng),
    !homeWins
  );
  if (homeScore === awayScore) {
    if (homeWins) homeScore += 2;
    else awayScore += 2;
  }

  const homeScoring = decomposeRLScore(homeScore);
  const awayScoring = decomposeRLScore(awayScore);

  return {
    winner: homeWins ? home : away,
    loser: homeWins ? away : home,
    fixture: {
      round,
      opponent: away,
      isHome: true,
      pointsFor: homeScore,
      pointsAgainst: awayScore,
      triesFor: homeScoring.tries,
      triesAgainst: awayScoring.tries,
      scoringFor: homeScoring,
      scoringAgainst: awayScoring,
      result: homeWins ? "W" : "L",
    },
  };
}

function simulateUserKnockout(
  squad: SquadSlot[],
  opponent: string,
  isHome: boolean,
  seed: string,
  round: number,
  matchKey: string
): { won: boolean; fixture: MatchFixture } {
  const state: MatchSimState = { form: 0, seasonDropGoals: 0 };
  const strength = calculateSquadStrength(squad);
  const rng = seedrandom(`${seed}-playoff-user-${matchKey}`);
  const opponentStrength =
    getGeneratedClubSquadStrength(opponent, seed, "season") + (isHome ? 0 : 3);

  const { fixture } = simulateOneFixture(
    squad,
    opponent,
    isHome,
    round,
    `${seed}-${matchKey}`,
    state,
    {
      cupMode: true,
      opponentRatingOverride: opponentStrength,
      draftMode: false,
    }
  );

  return { won: fixture.result === "W", fixture };
}

function buildUserFixture(
  opponent: string,
  isHome: boolean,
  isNeutral: boolean,
  won: boolean,
  fixture: MatchFixture
): MatchFixture {
  return {
    ...fixture,
    opponent,
    isHome: isNeutral ? false : isHome,
    result: won ? "W" : "L",
  };
}

export function simulatePlayoffs(
  squad: SquadSlot[],
  seed: string,
  leaguePosition: number,
  leagueTable: LeagueTableRow[]
): PlayoffResult {
  if (!userQualifiedForPlayoffs(leaguePosition)) {
    return {
      qualified: false,
      finish: "Missed Play-Offs",
      leaguePosition,
      rounds: [],
      userFixtures: [],
      wins: 0,
      losses: 0,
      isChampion: false,
      tryScorers: [],
    };
  }

  const first = teamAtPosition(leagueTable, 1);
  const second = teamAtPosition(leagueTable, 2);
  const third = teamAtPosition(leagueTable, 3);
  const fourth = teamAtPosition(leagueTable, 4);
  const fifth = teamAtPosition(leagueTable, 5);
  const sixth = teamAtPosition(leagueTable, 6);

  const rounds: PlayoffRoundResult[] = [];
  const userFixtures: MatchFixture[] = [];
  let wins = 0;
  let losses = 0;
  let eliminated = false;
  let finish: PlayoffFinish = "Super League Champions";

  const elim3v6 = simulateAiKnockout(third, sixth, seed, "elim-3v6", 28);
  const elim4v5 = simulateAiKnockout(fourth, fifth, seed, "elim-4v5", 28);

  const userElim =
    leaguePosition === 3
      ? { opponent: sixth, isHome: true }
      : leaguePosition === 6
        ? { opponent: third, isHome: false }
        : leaguePosition === 4
          ? { opponent: fifth, isHome: true }
          : leaguePosition === 5
            ? { opponent: fourth, isHome: false }
            : null;

  let elimWinnerLow: string;
  let elimWinnerHigh: string;

  if (userElim) {
    const userElimSim = simulateUserKnockout(
      squad,
      userElim.opponent,
      userElim.isHome,
      seed,
      28,
      "elim-user"
    );
    const userFixture = buildUserFixture(
      userElim.opponent,
      userElim.isHome,
      false,
      userElimSim.won,
      userElimSim.fixture
    );
    userFixtures.push(userFixture);
    if (userElimSim.won) wins++;
    else {
      losses++;
      eliminated = true;
      finish = "Eliminated in Eliminator";
    }

    const userWinner = userElimSim.won ? DREAM_TEAM_NAME : userElim.opponent;
    const userLoser = userElimSim.won ? userElim.opponent : DREAM_TEAM_NAME;

    if (leaguePosition === 3 || leaguePosition === 6) {
      elimWinnerLow = userWinner;
      elimWinnerHigh = elim4v5.winner;
    } else {
      elimWinnerLow = elim3v6.winner;
      elimWinnerHigh = userWinner;
    }

    rounds.push({
      round: "Eliminator",
      roundIndex: 1,
      opponent: userElim.opponent,
      isHome: userElim.isHome,
      isNeutral: false,
      userPlayed: true,
      userWon: userElimSim.won,
      fixture: userFixture,
      backgroundFixtures: [
        leaguePosition === 3 || leaguePosition === 6
          ? elim4v5.fixture
          : elim3v6.fixture,
      ],
    });
  } else {
    elimWinnerLow = elim3v6.winner;
    elimWinnerHigh = elim4v5.winner;
    rounds.push({
      round: "Eliminator",
      roundIndex: 1,
      opponent: "",
      isHome: false,
      isNeutral: false,
      userPlayed: false,
      userWon: null,
      fixture: elim3v6.fixture,
      backgroundFixtures: [elim4v5.fixture],
    });
  }

  if (!eliminated) {
    const semiOpponent =
      leaguePosition === 1
        ? elimWinnerLow
        : leaguePosition === 2
          ? elimWinnerHigh
          : leaguePosition === 3 || leaguePosition === 6
            ? first
            : second;

    const semiHome = leaguePosition === 1 || leaguePosition === 2;

    const userSemi =
      leaguePosition <= 2
        ? { opponent: semiOpponent, isHome: semiHome }
        : { opponent: semiOpponent, isHome: false };

    let semiWinnerLow: string;
    let semiWinnerHigh: string;

    if (leaguePosition === 1 || leaguePosition === 2) {
      const userSemiSim = simulateUserKnockout(
        squad,
        userSemi.opponent,
        userSemi.isHome,
        seed,
        29,
        leaguePosition === 1 ? "semi-1" : "semi-2"
      );
      const otherSemi =
        leaguePosition === 1
          ? simulateAiKnockout(second, elimWinnerHigh, seed, "semi-2", 29)
          : simulateAiKnockout(first, elimWinnerLow, seed, "semi-1", 29);

      const userFixture = buildUserFixture(
        userSemi.opponent,
        userSemi.isHome,
        false,
        userSemiSim.won,
        userSemiSim.fixture
      );
      userFixtures.push(userFixture);
      if (userSemiSim.won) wins++;
      else {
        losses++;
        eliminated = true;
        finish = "Eliminated in Semi-Final";
      }

      if (leaguePosition === 1) {
        semiWinnerLow = userSemiSim.won ? DREAM_TEAM_NAME : elimWinnerLow;
        semiWinnerHigh = otherSemi.winner;
      } else {
        semiWinnerLow = otherSemi.winner;
        semiWinnerHigh = userSemiSim.won ? DREAM_TEAM_NAME : elimWinnerHigh;
      }

      rounds.push({
        round: "Semi Final",
        roundIndex: 2,
        opponent: userSemi.opponent,
        isHome: userSemi.isHome,
        isNeutral: false,
        userPlayed: true,
        userWon: userSemiSim.won,
        fixture: userFixture,
        backgroundFixtures: [otherSemi.fixture],
      });
    } else if (userSemi) {
      const userSemiSim = simulateUserKnockout(
        squad,
        userSemi.opponent,
        userSemi.isHome,
        seed,
        29,
        "semi-user"
      );
      const userFixture = buildUserFixture(
        userSemi.opponent,
        userSemi.isHome,
        false,
        userSemiSim.won,
        userSemiSim.fixture
      );
      userFixtures.push(userFixture);
      if (userSemiSim.won) wins++;
      else {
        losses++;
        eliminated = true;
        finish = "Eliminated in Semi-Final";
      }

      const otherSemi =
        leaguePosition === 3 || leaguePosition === 6
          ? simulateAiKnockout(second, elimWinnerHigh, seed, "semi-bg", 29)
          : simulateAiKnockout(first, elimWinnerLow, seed, "semi-bg", 29);

      if (leaguePosition === 3 || leaguePosition === 6) {
        semiWinnerLow = userSemiSim.won ? DREAM_TEAM_NAME : userSemi.opponent;
        semiWinnerHigh = otherSemi.winner;
      } else {
        semiWinnerLow = otherSemi.winner;
        semiWinnerHigh = userSemiSim.won ? DREAM_TEAM_NAME : userSemi.opponent;
      }

      rounds.push({
        round: "Semi Final",
        roundIndex: 2,
        opponent: userSemi.opponent,
        isHome: userSemi.isHome,
        isNeutral: false,
        userPlayed: true,
        userWon: userSemiSim.won,
        fixture: userFixture,
        backgroundFixtures: [otherSemi.fixture],
      });
    } else {
      const semi1 = simulateAiKnockout(first, elimWinnerLow, seed, "semi-1", 29);
      const semi2 = simulateAiKnockout(second, elimWinnerHigh, seed, "semi-2", 29);
      semiWinnerLow = semi1.winner;
      semiWinnerHigh = semi2.winner;
      rounds.push({
        round: "Semi Final",
        roundIndex: 2,
        opponent: "",
        isHome: false,
        isNeutral: false,
        userPlayed: false,
        userWon: null,
        fixture: semi1.fixture,
        backgroundFixtures: [semi2.fixture],
      });
    }

    if (!eliminated) {
      const gfOpponent =
        leaguePosition === 1
          ? semiWinnerHigh
          : leaguePosition === 2
            ? semiWinnerLow
            : semiWinnerLow === DREAM_TEAM_NAME
              ? semiWinnerHigh
              : semiWinnerLow;

      const gfSim = simulateUserKnockout(
        squad,
        gfOpponent,
        false,
        seed,
        30,
        "grand-final"
      );
      const gfFixture = buildUserFixture(
        gfOpponent,
        false,
        true,
        gfSim.won,
        gfSim.fixture
      );
      userFixtures.push(gfFixture);
      if (gfSim.won) {
        wins++;
        finish = "Super League Champions";
      } else {
        losses++;
        finish = "Grand Final Runner-Up";
      }

      rounds.push({
        round: "Grand Final",
        roundIndex: 3,
        opponent: gfOpponent,
        isHome: false,
        isNeutral: true,
        userPlayed: true,
        userWon: gfSim.won,
        fixture: gfFixture,
        backgroundFixtures: [],
      });
    }
  }

  const tryScorers =
    userFixtures.length > 0
      ? distributeSeasonTries(squad, userFixtures, seed, wins)
      : [];

  return {
    qualified: true,
    finish,
    leaguePosition,
    rounds,
    userFixtures,
    wins,
    losses,
    isChampion: finish === "Super League Champions",
    tryScorers,
  };
}

export function getPlayoffFinishLabel(finish: PlayoffFinish): string {
  return finish;
}
