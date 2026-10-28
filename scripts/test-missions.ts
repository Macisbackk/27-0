/**
 * Daily Missions tests: the same three distinct missions for every player on a UK day, every
 * template checkable from end-of-run events, each mission paid once through the Club Funds
 * ledger and the all-three bonus paid once.
 * Run: npm run test:missions   (or: bun scripts/test-missions.ts)
 */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  key(i: number): string | null { return [...this.values.keys()][i] ?? null; }
  get length(): number { return this.values.size; }
}
const storage = new MemoryStorage();
Object.assign(globalThis, { window: Object.assign(new EventTarget(), { localStorage: storage }), localStorage: storage });
if (typeof globalThis.CustomEvent === "undefined") {
  class NodeCustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) { super(type); this.detail = init?.detail as T; }
  }
  Object.assign(globalThis, { CustomEvent: NodeCustomEvent });
}

// Supabase is unconfigured here (no env), so the Club Funds cloud sync / leaderboard calls no-op.

let failures = 0;
let checks = 0;
function check(condition: unknown, message: string): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`✗ ${message}`);
  }
}

type MissionEvent = import("../src/lib/daily-missions").MissionEvent;
type DailyMission = import("../src/lib/daily-missions").DailyMission;
type SquadSlot = import("../src/lib/types").SquadSlot;
type Player = import("../src/lib/types").Player;

async function main(): Promise<void> {
  const missions = await import("../src/lib/daily-missions");
  const { seasonMissionEvent } = await import("../src/lib/daily-missions-season");
  const funds = await import("../src/lib/storage/club-funds");
  const owner = await import("../src/lib/storage/account-owner");
  const { getLocalDateKey } = await import("../src/lib/mini-games/date");

  const {
    DAILY_MISSION_TEMPLATES,
    DAILY_MISSIONS_ALL_BONUS,
    DAILY_MISSIONS_CHANGED_EVENT,
    DAILY_MISSIONS_STORAGE_KEY,
    applyMissionEvent,
    buildDailyMission,
    getDailyMissions,
    getDailyMissionsView,
    missionRunId,
    missionsAllRunId,
    reportMissionEvent,
  } = missions;

  // --- Events -----------------------------------------------------------------------------------
  const baseSeason: Extract<MissionEvent, { kind: "season" }> = {
    kind: "season",
    mode: "CLASSIC",
    era: false,
    daily: false,
    hidden: false,
    wins: 10,
    losses: 17,
    leaguePosition: 10,
    pointsDifference: -50,
    chemistryLinks: 0,
    clubsBySlot: Array.from({ length: 13 }, (_, i) => `club ${i}`),
  };
  const season = (over: Partial<typeof baseSeason>): MissionEvent => ({ ...baseSeason, ...over });

  /** An event that completes `m` in one go (or one step of it for "sum" missions). */
  function passingEvent(m: DailyMission): MissionEvent {
    const p = m.param;
    switch (m.templateId) {
      case "win-games": return season({ wins: Number(p) });
      case "top-table": return season({ leaguePosition: 1 });
      case "grand-final": return { kind: "playoffs", mode: "CLASSIC", hidden: false, champion: true };
      case "make-playoffs": return season({ leaguePosition: 6 });
      case "few-losses": return season({ losses: Number(p) });
      case "points-diff": return season({ pointsDifference: Number(p) });
      case "chemistry": return season({ chemistryLinks: Number(p) });
      case "spine": {
        const clubs = [...baseSeason.clubsBySlot];
        clubs[0] = "wigan warriors";
        clubs[8] = "wigan warriors";
        return season({ clubsBySlot: clubs });
      }
      case "club-players": {
        const clubs = [...baseSeason.clubsBySlot];
        clubs[3] = String(p).toLowerCase();
        clubs[11] = String(p).toLowerCase();
        return season({ clubsBySlot: clubs });
      }
      case "wordle-win": return { kind: "wordle", won: true };
      case "grid-finish": return { kind: "grid", daily: true, score: 2 };
      case "grid-score": return { kind: "grid", daily: true, score: Number(p) };
      case "daily-challenge": return season({ daily: true });
      case "era-run": return season({ era: true });
      case "seasons-played": return season({});
      case "manager-wins": return { kind: "manager", won: true };
      default: throw new Error(`no passing event for template ${m.templateId}`);
    }
  }

  /** A near miss: the right kind of event that must NOT complete `m`. */
  function failingEvent(m: DailyMission): MissionEvent {
    const p = m.param;
    switch (m.templateId) {
      case "win-games": return season({ wins: Number(p) - 1 });
      case "top-table": return season({ leaguePosition: 2 });
      case "grand-final": return { kind: "playoffs", mode: "CLASSIC", hidden: false, champion: false };
      case "make-playoffs": return season({ leaguePosition: 7 });
      case "few-losses": return season({ losses: Number(p) + 1 });
      case "points-diff": return season({ pointsDifference: Number(p) - 1 });
      case "chemistry": return season({ chemistryLinks: Number(p) - 1 });
      case "spine": return season({});
      case "club-players": {
        const clubs = [...baseSeason.clubsBySlot];
        clubs[3] = String(p).toLowerCase();
        return season({ clubsBySlot: clubs });
      }
      case "wordle-win": return { kind: "wordle", won: false };
      case "grid-finish": return { kind: "grid", daily: false, score: 9 };
      case "grid-score": return { kind: "grid", daily: true, score: Number(p) - 1 };
      case "daily-challenge": return season({ daily: false });
      case "era-run": return season({ era: false });
      case "seasons-played": return { kind: "wordle", won: true };
      case "manager-wins": return { kind: "manager", won: false };
      default: throw new Error(`no failing event for template ${m.templateId}`);
    }
  }

  function runToTarget(m: DailyMission, event: MissionEvent): number {
    let progress = 0;
    for (let i = 0; i < m.target + 2; i++) progress = applyMissionEvent(m, progress, event);
    return progress;
  }

  // --- Pool -------------------------------------------------------------------------------------
  check(DAILY_MISSION_TEMPLATES.length >= 14, `pool has ~15 templates (${DAILY_MISSION_TEMPLATES.length})`);
  check(new Set(DAILY_MISSION_TEMPLATES.map((t) => t.id)).size === DAILY_MISSION_TEMPLATES.length, "template ids unique");
  for (const template of DAILY_MISSION_TEMPLATES) {
    for (const param of template.params) {
      const m = buildDailyMission(template, param);
      const label = `${m.id}(${String(param)})`;
      check(m.reward >= 15_000 && m.reward <= 30_000, `${label} reward in £15k–£30k (${m.reward})`);
      check(m.title.length > 0 && m.title.length <= 64, `${label} has a short title`);
      check(runToTarget(m, passingEvent(m)) === m.target, `${label} completes from its event`);
      check(runToTarget(m, failingEvent(m)) < m.target, `${label} near miss does not complete`);
      if (m.accumulate === "max") {
        check(applyMissionEvent(m, 0, failingEvent(m)) < m.target, `${label} near miss below target`);
      } else {
        check(applyMissionEvent(m, 0, passingEvent(m)) < m.target || m.target === 1, `${label} sum needs several events`);
      }
      // Hidden runs and non-Classic modes never count for season missions.
      const pass = passingEvent(m);
      if (pass.kind === "season" || pass.kind === "playoffs") {
        check(applyMissionEvent(m, 0, { ...pass, hidden: true }) === 0, `${label} ignores hidden runs`);
        check(applyMissionEvent(m, 0, { ...pass, mode: "DRAFT" }) === 0, `${label} ignores Draft runs`);
      }
    }
  }

  // --- Daily selection --------------------------------------------------------------------------
  const seenTemplates = new Set<string>();
  for (let day = 0; day < 400; day++) {
    const key = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    const a = getDailyMissions(key);
    const b = getDailyMissions(key);
    check(JSON.stringify(a) === JSON.stringify(b), `${key} deterministic`);
    check(a.length === 3, `${key} has three missions`);
    check(new Set(a.map((m) => m.id)).size === 3, `${key} missions distinct`);
    check(new Set(a.map((m) => m.category)).size === 3, `${key} missions from three categories`);
    a.forEach((m) => seenTemplates.add(m.templateId));
    if (key < missions.MANAGER_MISSIONS_FROM) check(!a.some((m) => m.templateId === "manager-wins"), `${key} no Manager mission before it joins the pool`);
  }
  const enabledIds = DAILY_MISSION_TEMPLATES.filter((t) => t.enabled !== false).map((t) => t.id);
  check(enabledIds.every((id) => seenTemplates.has(id)), "every enabled template appears within 400 days");
  check(
    JSON.stringify(getDailyMissions("2026-11-01")) !== JSON.stringify(getDailyMissions("2026-11-02")) ||
      JSON.stringify(getDailyMissions("2026-11-02")) !== JSON.stringify(getDailyMissions("2026-11-03")),
    "missions change between days"
  );
  // Same UK day either side of a clock change / late evening → same missions.
  check(
    getLocalDateKey(new Date("2026-10-25T23:30:00Z")) === getLocalDateKey(new Date("2026-10-25T08:00:00Z")),
    "UK day key spans the GMT evening"
  );

  // --- Season event from a squad ---------------------------------------------------------------
  function player(id: string, club: string, cardYear?: number): Player {
    return { id, name: id, club, displayClub: club, position: "PROP", cardYear } as unknown as Player;
  }
  const squad: SquadSlot[] = Array.from({ length: 13 }, (_, i) => ({
    position: "PROP",
    slotIndex: i,
    label: `slot ${i}`,
    player: player(`p${i}`, i === 5 || i === 6 ? "Wigan Warriors '98" : i === 0 ? "Wigan Warriors" : `Other ${i}`),
  })) as SquadSlot[];
  const built = seasonMissionEvent({
    squad,
    result: { wins: 20, losses: 7, pointsDifference: 320 },
    leaguePosition: 2,
    mode: "CLASSIC",
    era: true,
  });
  check(built.kind === "season" && built.chemistryLinks === 1, "squad halves link counted as chemistry");
  check(built.kind === "season" && built.clubsBySlot[5] === "wigan warriors" && built.clubsBySlot[0] === "wigan warriors", "era suffix stripped from clubs");
  const chemistryMission = buildDailyMission(DAILY_MISSION_TEMPLATES.find((t) => t.id === "chemistry")!, 1);
  check(applyMissionEvent(chemistryMission, 0, built) === 0, "chemistry mission ignores Era seasons (no chemistry in Era)");
  check(
    applyMissionEvent(chemistryMission, 0, { ...built, era: false } as MissionEvent) === chemistryMission.target,
    "chemistry mission counts a Classic season's links"
  );
  const spine = buildDailyMission(DAILY_MISSION_TEMPLATES.find((t) => t.id === "spine")!, null);
  check(applyMissionEvent(spine, 0, built) === spine.target, "spine mission from a real squad");
  const wiganMission = buildDailyMission(DAILY_MISSION_TEMPLATES.find((t) => t.id === "club-players")!, "Wigan Warriors");
  check(applyMissionEvent(wiganMission, 0, built) === wiganMission.target, "club mission from a real squad");

  // --- Payouts through the ledger ---------------------------------------------------------------
  check(owner.ACCOUNT_STORAGE_KEYS.includes(DAILY_MISSIONS_STORAGE_KEY), "mission progress is per account");

  const now = new Date("2026-11-04T12:00:00Z");
  const dateKey = getLocalDateKey(now);
  const today = getDailyMissions(dateKey);
  const events: { detail: unknown }[] = [];
  window.addEventListener(DAILY_MISSIONS_CHANGED_EVENT, (e) => events.push(e as CustomEvent));

  const startBalance = funds.getClubFundsBalance();
  check(getDailyMissionsView(now).missions.every((m) => !m.complete), "nothing complete at start");

  // A run that completes none of today's missions pays nothing.
  for (const m of today) {
    const r = reportMissionEvent(failingEvent(m), now);
    check(r.payout === null && r.completed.length === 0, `${m.id} near miss pays nothing`);
  }
  check(funds.getClubFundsBalance() === startBalance, "balance unchanged after near misses");

  let expected = startBalance;
  for (const [index, m] of today.entries()) {
    let paid = 0;
    for (let i = 0; i < m.target + 1; i++) {
      const r = reportMissionEvent(passingEvent(m), now);
      paid += r.payout?.total ?? 0;
    }
    const isLast = index === today.length - 1;
    check(paid === m.reward + (isLast ? DAILY_MISSIONS_ALL_BONUS : 0), `${m.id} paid once (${paid})`);
    expected += paid;
    check(funds.getPaidRunIds().includes(missionRunId(dateKey, m.id)), `${m.id} ledger id mission:<date>:<id>`);
    check(funds.getPaidRunIds().includes(missionsAllRunId(dateKey)) === isLast, `bonus only after all three (${index})`);
  }
  check(funds.getClubFundsBalance() === expected, "balance = three rewards + bonus");
  const total = today.reduce((s, m) => s + m.reward, 0) + DAILY_MISSIONS_ALL_BONUS;
  check(expected - startBalance === total, `all three + bonus paid exactly once (${total})`);

  // Replaying every event again pays nothing more.
  for (const m of today) reportMissionEvent(passingEvent(m), now);
  check(funds.getClubFundsBalance() === expected, "replays pay nothing");
  const view = getDailyMissionsView(now);
  check(view.missions.every((m) => m.complete && m.paid) && view.bonus.paid, "view shows all done");
  check(events.some((e) => (e.detail as { bonus: number }).bonus === DAILY_MISSIONS_ALL_BONUS), "bonus event dispatched");

  // Lost local progress (cleared storage / second device) still reads as done from the ledger.
  storage.removeItem(DAILY_MISSIONS_STORAGE_KEY);
  check(getDailyMissionsView(now).missions.every((m) => m.complete), "ledger alone marks missions done");
  for (const m of today) reportMissionEvent(passingEvent(m), now);
  check(funds.getClubFundsBalance() === expected, "no re-pay after local progress loss");

  // Next day starts fresh.
  const tomorrow = new Date("2026-11-05T12:00:00Z");
  check(getDailyMissionsView(tomorrow).missions.every((m) => !m.complete), "next day starts fresh");

  if (failures > 0) {
    console.error(`${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
