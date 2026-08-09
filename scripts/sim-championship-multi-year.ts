/**
 * Smoke: Championship career cup unlocks + multi-year advance continuity.
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { advanceToNextSeason } from "../src/lib/manager/managerStateSeason";
import { simulateCareerToGameWeek } from "../src/lib/manager/managerSimToDate";
import {
  getCupTriggersForSeasonGames,
  getPendingCupBracketRound,
  countCupFixturesPlayed,
  countLeagueFixturesPlayed,
} from "../src/lib/manager/managerChallengeCup";
import {
  getCareerChampionshipClubs,
  getCareerSuperLeagueClubs,
  getUserCompetitionId,
  getUserSeasonGames,
  isUserInChampionship,
} from "../src/lib/manager/leagueMembership";
import { CHAMPIONSHIP_CLUB_NAMES } from "../src/lib/clubs/championship-clubs";

const YEARS = Number(process.env.SIM_YEARS ?? 3);
const CLUB = process.env.SIM_CLUB ?? CHAMPIONSHIP_CLUB_NAMES[0]!;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main() {
  const triggers = getCupTriggersForSeasonGames(38);
  assert(triggers.length === 6, `expected 6 cup triggers, got ${triggers.length}`);
  assert(
    triggers.every((t, i) => i === 0 || t > triggers[i - 1]!),
    `cup triggers not increasing: ${triggers.join(",")}`
  );
  assert(
    triggers[5]! <= 38,
    `final cup trigger ${triggers[5]} exceeds Champ season length 38`
  );
  console.log("cupTriggers(38)=", triggers.join(","));

  let career = createNewCareer(CLUB, 9);
  assert(isUserInChampionship(career), "career should start in Championship");
  assert(getUserSeasonGames(career) === 38, "Champ season games should be 38");

  // Every opponent once home and once away.
  const leagueOnly = career.schedule.filter((f) => f.competition === "league");
  assert(leagueOnly.length === 38, `expected 38 league fixtures, got ${leagueOnly.length}`);
  const byOpp = new Map<string, { home: number; away: number }>();
  for (const f of leagueOnly) {
    const row = byOpp.get(f.opponent) ?? { home: 0, away: 0 };
    if (f.isHome) row.home++;
    else row.away++;
    byOpp.set(f.opponent, row);
  }
  for (const [opp, row] of byOpp) {
    assert(
      row.home === 1 && row.away === 1,
      `${opp}: expected 1 home + 1 away, got ${row.home}H/${row.away}A`
    );
  }

  assert(
    career.attendanceData.baseAttendance !== 2_800 ||
      career.attendanceData.stadiumCapacity !== 7_500,
    `attendance still generic for ${career.club}`
  );
  console.log(
    `attendance ${career.club}: base=${career.attendanceData.baseAttendance} cap=${career.attendanceData.stadiumCapacity}`
  );

  assert(
    getCareerChampionshipClubs(career).length === 20,
    "need 20 Champ clubs"
  );
  assert(
    getCareerSuperLeagueClubs(career).length === 14,
    "need 14 SL clubs"
  );
  assert(
    career.challengeCup?.matches?.length,
    "challenge cup bracket missing at career start"
  );

  const seasonGames = getUserSeasonGames(career);
  const toEnd = simulateCareerToGameWeek(career, seasonGames);
  career = toEnd.career;
  console.log(
    `Y1 sim: ok=${toEnd.ok} matches=${toEnd.matchesSimulated} weeks=${toEnd.weeksAdvanced} err=${toEnd.error ?? ""} gw=${career.gameWeek} leaguePlayed=${countLeagueFixturesPlayed(career)} cupPlayed=${countCupFixturesPlayed(career)} seasonComplete=${career.isSeasonComplete}`
  );

  // After league slate, remaining cup rounds must be unlockable (no soft-lock).
  if (!career.challengeCup?.userEliminated && !career.challengeCup?.tournamentComplete) {
    const pending = getPendingCupBracketRound(career);
    const cupPlayed = countCupFixturesPlayed(career);
    if (countLeagueFixturesPlayed(career) >= seasonGames && cupPlayed < 6) {
      assert(
        pending !== null,
        `soft-lock: league done, cupPlayed=${cupPlayed}, pending=${pending}`
      );
    }
  }

  // Drain remaining cup / week advances until season complete (bounded).
  for (let i = 0; i < 40 && !career.isSeasonComplete; i++) {
    const pending = getPendingCupBracketRound(career);
    const target =
      pending != null
        ? Math.max(career.gameWeek, getUserSeasonGames(career))
        : career.gameWeek + 1;
    const step = simulateCareerToGameWeek(career, target);
    career = step.career;
    if (!step.ok && step.error?.includes("No fixture")) break;
    if (step.matchesSimulated === 0 && step.weeksAdvanced === 0) break;
  }

  console.log(
    `Y1 end: seasonComplete=${career.isSeasonComplete} cupElim=${career.challengeCup?.userEliminated} cupDone=${career.challengeCup?.tournamentComplete} cupPlayed=${countCupFixturesPlayed(career)}`
  );

  for (let y = 2; y <= YEARS; y++) {
    assert(career.isSeasonComplete, `cannot advance — season not complete at Y${y}`);
    career = advanceToNextSeason(career);
    assert(
      getCareerChampionshipClubs(career).length === 20,
      `Y${y}: Champ membership size`
    );
    assert(
      getCareerSuperLeagueClubs(career).length === 14,
      `Y${y}: SL membership size`
    );
    assert(
      career.challengeCup?.matches?.length,
      `Y${y}: cup missing after advance`
    );
    assert(
      career.aiSuperLeagueLastRound == null,
      `Y${y}: AI SL lastRound should reset between Champ seasons`
    );
    assert(career.gameWeek === 0, `Y${y}: gameWeek should reset`);
    assert(!career.isSeasonComplete, `Y${y}: new season should not be complete`);
    assert(
      career.playoffs == null,
      `Y${y}: Champ careers must not carry SL playoffs`
    );

    const mid = simulateCareerToGameWeek(career, Math.min(8, getUserSeasonGames(career)));
    career = mid.career;
    assert(mid.ok || mid.stoppedEarly, `Y${y} mid-sim failed: ${mid.error}`);

    const toEndY = simulateCareerToGameWeek(career, getUserSeasonGames(career));
    career = toEndY.career;
    for (let i = 0; i < 40 && !career.isSeasonComplete; i++) {
      const step = simulateCareerToGameWeek(
        career,
        Math.max(career.gameWeek + 1, getUserSeasonGames(career))
      );
      career = step.career;
      if (!step.ok && step.error?.includes("No fixture")) break;
      if (step.matchesSimulated === 0 && step.weeksAdvanced === 0) break;
    }

    console.log(
      `Y${y}: competition=${getUserCompetitionId(career)} complete=${career.isSeasonComplete} cupPlayed=${countCupFixturesPlayed(career)} slClubs=${getCareerSuperLeagueClubs(career).slice(0, 3).join("|")}…`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        club: CLUB,
        years: YEARS,
        finalCompetition: getUserCompetitionId(career),
        finalSeasonYear: career.seasonYear,
        champClubs: getCareerChampionshipClubs(career).length,
        slClubs: getCareerSuperLeagueClubs(career).length,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
