/**
 * Ad-hoc stress checks for board objective settlement edge cases.
 */
import { initializeManagerDatabase } from "../src/lib/manager/database";
import {
  refreshClubBoardObjectives,
  countAcademyGraduateFirstTeamApps,
} from "../src/lib/manager/objectives";

const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (!cond) {
    fails.push(msg);
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function forceTable(
  state: ReturnType<typeof initializeManagerDatabase>,
  competitionId: "super-league" | "championship",
  clubId: string,
  desiredRank: number // 1-based
) {
  const st = state.competitions[competitionId].standings;
  const me = st.find((r) => r.clubId === clubId);
  if (!me) throw new Error(`${clubId} not in ${competitionId}`);
  const others = st.filter((r) => r.clubId !== clubId);
  const ordered = [];
  let oi = 0;
  for (let rank = 1; rank <= st.length; rank++) {
    if (rank === desiredRank) {
      ordered.push({
        ...me,
        played: 26,
        points: 100 - rank,
        pointsDifference: 50 - rank,
      });
    } else {
      ordered.push({
        ...others[oi++],
        played: 26,
        points: 100 - rank,
        pointsDifference: 50 - rank,
      });
    }
  }
  return {
    ...state,
    competitions: {
      ...state.competitions,
      [competitionId]: {
        ...state.competitions[competitionId],
        standings: ordered,
      },
    },
  };
}

const slClub =
  Object.values(initializeManagerDatabase("wigan-warriors", "seed").clubs).find(
    (c) => c.competitionId === "super-league" && c.reputation <= 2
  )?.id || "catalans-dragons";

// 1) 14th fails Avoid Relegation after RS
let s = initializeManagerDatabase(slClub, "X");
s = {
  ...s,
  calendar: { ...s.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...s.clubs,
    [slClub]: {
      ...s.clubs[slClub],
      boardObjectives: [
        {
          id: "rel",
          title: "Avoid Relegation",
          description: "x",
          category: "league",
          targetValue: 13,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
s = forceTable(s, "super-league", slClub, 14);
const rel = refreshClubBoardObjectives(s, slClub).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(Number(rel.currentValue) === 14, "Club ranked 14 at RS end");
check(rel.isFailed === true, "Avoid Relegation fails in 14th after RS");
check(rel.isCompleted === false, "Avoid Relegation not completed in 14th");

// 2) 13th after RS does NOT complete until MPG
let mpgPending = initializeManagerDatabase(slClub, "MPG");
mpgPending = {
  ...mpgPending,
  calendar: { ...mpgPending.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...mpgPending.clubs,
    [slClub]: {
      ...mpgPending.clubs[slClub],
      boardObjectives: [
        {
          id: "rel",
          title: "Avoid Relegation",
          description: "x",
          category: "league",
          targetValue: 13,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
mpgPending = forceTable(mpgPending, "super-league", slClub, 13);
const pending = refreshClubBoardObjectives(mpgPending, slClub).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(Number(pending.currentValue) === 13, "Club ranked 13th (MPG spot)");
check(!pending.isCompleted && !pending.isFailed, "13th leaves Avoid Relegation unsettled until MPG");

// 3) 13th wins MPG → complete
let mpgWin = {
  ...mpgPending,
  calendar: { ...mpgPending.calendar, phase: "season_end", currentWeek: 33 },
  competitions: {
    ...mpgPending.competitions,
    "super-league": {
      ...mpgPending.competitions["super-league"],
      fixtures: [
        ...mpgPending.competitions["super-league"].fixtures,
        {
          id: "mpg_win",
          competitionId: "super-league" as const,
          season: mpgPending.calendar.currentSeason,
          week: 32,
          roundName: "The Million Pound Game",
          homeClubId: slClub,
          awayClubId: "widnes-vikings",
          isPlayed: true,
          homeScore: 20,
          awayScore: 12,
        },
      ],
    },
  },
};
const won = refreshClubBoardObjectives(mpgWin, slClub).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(won.isCompleted === true, "Avoid Relegation completes after winning MPG");

// 4) 13th loses MPG → fail
let mpgLose = {
  ...mpgPending,
  calendar: { ...mpgPending.calendar, phase: "season_end", currentWeek: 33 },
  competitions: {
    ...mpgPending.competitions,
    "super-league": {
      ...mpgPending.competitions["super-league"],
      fixtures: [
        ...mpgPending.competitions["super-league"].fixtures,
        {
          id: "mpg_lose",
          competitionId: "super-league" as const,
          season: mpgPending.calendar.currentSeason,
          week: 32,
          roundName: "The Million Pound Game",
          homeClubId: slClub,
          awayClubId: "widnes-vikings",
          isPlayed: true,
          homeScore: 10,
          awayScore: 18,
        },
      ],
    },
  },
};
const lost = refreshClubBoardObjectives(mpgLose, slClub).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(lost.isFailed === true, "Avoid Relegation fails after losing MPG");

// 5) 12th completes after RS (safe)
let safe = initializeManagerDatabase(slClub, "Safe");
safe = {
  ...safe,
  calendar: { ...safe.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...safe.clubs,
    [slClub]: {
      ...safe.clubs[slClub],
      boardObjectives: [
        {
          id: "rel",
          title: "Avoid Relegation",
          description: "x",
          category: "league",
          targetValue: 13,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
safe = forceTable(safe, "super-league", slClub, 12);
const safeObj = refreshClubBoardObjectives(safe, slClub).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(Number(safeObj.currentValue) === 12, "Club ranked 12th");
check(safeObj.isCompleted === true, "Avoid Relegation completes in 12th after RS");

// 6) Consolidate / promotion / youth / top6 / lock — keep prior coverage
let c = initializeManagerDatabase("widnes-vikings", "Y");
const champClubId = Object.values(c.clubs).find(
  (cl) => cl.competitionId === "championship"
)!.id;
c = {
  ...c,
  calendar: { ...c.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...c.clubs,
    [champClubId]: {
      ...c.clubs[champClubId],
      boardObjectives: [
        {
          id: "cons",
          title: "Consolidate Championship Status",
          description: "x",
          category: "league",
          targetValue: 10,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
c = forceTable(c, "championship", champClubId, 12);
const cons = refreshClubBoardObjectives(c, champClubId).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(cons.isFailed === true, "Consolidate fails outside top 10 after RS");

let p = initializeManagerDatabase(champClubId, "Z");
p = {
  ...p,
  calendar: { ...p.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...p.clubs,
    [champClubId]: {
      ...p.clubs[champClubId],
      boardObjectives: [
        {
          id: "promo",
          title: "Gain Promotion to Super League",
          description: "x",
          category: "league",
          targetValue: 1,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
p = forceTable(p, "championship", champClubId, 1);
const promo = refreshClubBoardObjectives(p, champClubId).boardObjectives.find(
  (o) => o.category === "league"
)!;
check(promo.isCompleted === true, "Promotion completes when finishing 1st after RS");

let y = initializeManagerDatabase("widnes-vikings", "Y2");
const kid = Object.values(y.players).find(
  (pl) => pl.clubId === "widnes-vikings" && pl.squadTier === "academy"
)!;
y = {
  ...y,
  players: {
    ...y.players,
    [kid.id]: { ...kid, stats: { ...kid.stats, apps: 3 } },
  },
  calendar: { ...y.calendar, phase: "season_end", currentWeek: 33 },
};
check(
  countAcademyGraduateFirstTeamApps(y, "widnes-vikings") >= 3,
  "Academy-tier apps still count as graduate apps"
);
const yObj = refreshClubBoardObjectives(y, "widnes-vikings").boardObjectives.find(
  (o) => o.category === "youth"
)!;
check(yObj.isFailed === true && !yObj.isCompleted, "Youth fails at season_end when under target");

let t = initializeManagerDatabase("leeds-rhinos", "T6");
t = {
  ...t,
  calendar: { ...t.calendar, phase: "playoffs", currentWeek: 29 },
  clubs: {
    ...t.clubs,
    "leeds-rhinos": {
      ...t.clubs["leeds-rhinos"],
      boardObjectives: [
        {
          id: "t6",
          title: "Reach the Top 6 Playoffs",
          description: "x",
          category: "league",
          targetValue: 6,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
t = forceTable(t, "super-league", "leeds-rhinos", 7);
const t6 = refreshClubBoardObjectives(t, "leeds-rhinos").boardObjectives.find(
  (o) => o.category === "league"
)!;
check(t6.isFailed === true, "Top 6 fails when finishing 7th");

let locked = initializeManagerDatabase("wigan-warriors", "L");
locked = {
  ...locked,
  calendar: { ...locked.calendar, phase: "season_end", currentWeek: 33 },
  clubs: {
    ...locked.clubs,
    "wigan-warriors": {
      ...locked.clubs["wigan-warriors"],
      boardObjectives: locked.clubs["wigan-warriors"].boardObjectives.map((o) =>
        o.category === "league"
          ? {
              ...o,
              title: "Compete for the Grand Final",
              targetValue: 4,
              isCompleted: true,
              isFailed: false,
              currentValue: 2,
            }
          : o
      ),
    },
  },
};
locked = forceTable(locked, "super-league", "wigan-warriors", 14);
const lockedObj = refreshClubBoardObjectives(
  locked,
  "wigan-warriors"
).boardObjectives.find((o) => o.category === "league")!;
check(
  lockedObj.isCompleted === true && lockedObj.isFailed === false,
  "Already-completed league objective stays completed"
);

let gf = initializeManagerDatabase("wigan-warriors", "GF");
gf = {
  ...gf,
  calendar: { ...gf.calendar, phase: "season_end", currentWeek: 33 },
  clubs: {
    ...gf.clubs,
    "wigan-warriors": {
      ...gf.clubs["wigan-warriors"],
      boardObjectives: [
        {
          id: "gf",
          title: "Compete for the Grand Final",
          description: "x",
          category: "league",
          targetValue: 4,
          currentValue: 1,
          isCompleted: false,
          isFailed: false,
          importance: "high",
        },
      ],
    },
  },
};
gf = forceTable(gf, "super-league", "wigan-warriors", 5);
const gfObj = refreshClubBoardObjectives(gf, "wigan-warriors").boardObjectives.find(
  (o) => o.category === "league"
)!;
check(gfObj.isFailed === true, "Compete for GF fails finishing 5th without reaching GF");

if (fails.length) {
  console.error("\nFAILURES:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("\nALL AD-HOC OBJECTIVE STRESS CHECKS PASSED");
