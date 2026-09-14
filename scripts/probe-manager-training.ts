/**
 * Probe: does Manager training actually change ratings/fitness?
 * Run: npx tsx scripts/probe-manager-training.ts
 */

const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
};
(globalThis as any).crypto = require("crypto").webcrypto;
(globalThis as any).indexedDB = {
  open() {
    const r: any = { onerror: null, onsuccess: null, error: new Error("x") };
    queueMicrotask(() => r.onerror?.({}));
    return r;
  },
};

async function main() {
  const { initializeManagerDatabase } = await import("../src/lib/manager/database");
  const { confirmFriendlyOpponents } = await import("../src/lib/manager/competitions");
  const { advanceWeek } = await import("../src/lib/manager/advancement");
  const { setPlayerTrainingFocus, progressPlayerWeek } = await import("../src/lib/manager/player");

  let state = initializeManagerDatabase("halifax-panthers", "TrainProbe");
  const uid = state.manager.clubId;
  const picked = (state.pendingFriendlyOpponents || []).slice(0, 3);
  state = confirmFriendlyOpponents(state, picked).state;

  const youth = Object.values(state.players)
    .filter((p) => p.clubId === uid && p.age <= 22 && p.potential - p.rating >= 6)
    .sort((a, b) => b.potential - a.rating)[0];

  if (!youth) throw new Error("No youth prospect found");

  const focused = setPlayerTrainingFocus(state.players[youth.id], "development");
  state = {
    ...state,
    players: { ...state.players, [youth.id]: focused },
    clubs: {
      ...state.clubs,
      [uid]: {
        ...state.clubs[uid],
        tactics: { ...state.clubs[uid].tactics, trainingIntensity: "high" },
      },
    },
  };

  if (state.players[youth.id].trainingFocus !== "development") {
    throw new Error("Focus not set before advance");
  }

  const before = {
    rating: state.players[youth.id].rating,
    fatigue: state.players[youth.id].fatigue,
    fitness: state.players[youth.id].fitness,
    form: state.players[youth.id].form,
  };

  let unit = { ...state.players[youth.id], fatigue: 20, fitness: 90 };
  let unitGains = 0;
  for (let i = 0; i < 40; i++) {
    const next = progressPlayerWeek(unit, "high", 4, 3);
    if (next.rating > unit.rating) unitGains++;
    unit = next;
  }

  for (let w = 0; w < 12; w++) {
    state = advanceWeek(state);
  }
  const after = state.players[youth.id];

  console.log(
    JSON.stringify(
      {
        player: youth.name,
        age: youth.age,
        focusAfterAdvance: after.trainingFocus,
        before,
        after: {
          rating: after.rating,
          fatigue: after.fatigue,
          fitness: after.fitness,
          form: after.form,
        },
        ratingGain: after.rating - before.rating,
        unitTestRatingUpsIn40Weeks: unitGains,
        unitFinalRating: unit.rating,
        unitFinalFatigue: unit.fatigue,
      },
      null,
      2
    )
  );

  if (after.trainingFocus !== "development") {
    console.error("FAIL: training focus lost during advanceWeek");
    process.exit(1);
  }
  if (unitGains === 0 && unit.fatigue === 20) {
    console.error("FAIL: progressPlayerWeek had no effect");
    process.exit(1);
  }
  console.log("PASS: training focus persists; weekly progress applies");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
