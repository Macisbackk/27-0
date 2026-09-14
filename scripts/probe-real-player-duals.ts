/**
 * Verify real-player duals come from squad data; SO/SH collapse to HB.
 * Run: npx tsx scripts/probe-real-player-duals.ts
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
  const squads = require("../data/current-squads.json") as Array<{
    id: string;
    name: string;
    position?: string;
    positions?: string[];
  }>;
  const { initializeManagerDatabase, resolveSecondaryFromSquadPositions } =
    await import("../src/lib/manager/database");
  const { formatPositionPair, formatPositionShort } = await import(
    "../src/lib/manager/formatters"
  );

  const bugs: string[] = [];
  const ok: string[] = [];

  // Unit: SO+SH only → no secondary
  const soSh = resolveSecondaryFromSquadPositions("STAND_OFF", ["STAND_OFF", "SCRUM_HALF"]);
  if (soSh === undefined) ok.push("SO+SH → no secondary");
  else bugs.push(`SO+SH secondary=${soSh}`);

  // Unit: CE/WG → WING
  const cewg = resolveSecondaryFromSquadPositions("CENTRE", ["CENTRE", "WING"]);
  if (cewg === "WING") ok.push("CE/WG → WING");
  else bugs.push(`CE/WG secondary=${cewg}`);

  // Unit: HK/HB → halfback secondary
  const hkhb = resolveSecondaryFromSquadPositions("HOOKER", [
    "HOOKER",
    "STAND_OFF",
    "SCRUM_HALF",
  ]);
  if (hkhb === "STAND_OFF" || hkhb === "SCRUM_HALF") ok.push(`HK/HB → ${hkhb}`);
  else bugs.push(`HK/HB secondary=${hkhb}`);

  // Display
  if (formatPositionShort("STAND_OFF") === "HB" && formatPositionShort("SCRUM_HALF") === "HB") {
    ok.push("SO/SH display as HB");
  } else bugs.push("SO/SH not HB");
  if (formatPositionPair("STAND_OFF", "SCRUM_HALF") === "HB") ok.push("pair SO/SH → HB");
  else bugs.push(`pair SO/SH=${formatPositionPair("STAND_OFF", "SCRUM_HALF")}`);
  if (formatPositionPair("CENTRE", "WING") === "CE/WG") ok.push("pair CE/WG");
  else bugs.push(`pair CE/WG=${formatPositionPair("CENTRE", "WING")}`);

  const state = initializeManagerDatabase("wigan-warriors", "DualAudit");
  const byId = state.players;

  let imported = 0;
  let withSecondary = 0;
  let wrongSecondary = 0;
  let fakeSecondary = 0;
  const examples: string[] = [];

  for (const raw of squads) {
    const p = byId[raw.id];
    if (!p) continue;
    imported++;
    const expected = resolveSecondaryFromSquadPositions(p.position, raw.positions);
    if (expected) {
      if (p.secondaryPosition === expected) {
        withSecondary++;
        if (examples.length < 8) {
          examples.push(
            `${p.name}: ${formatPositionPair(p.position, p.secondaryPosition)}`
          );
        }
      } else {
        wrongSecondary++;
        bugs.push(
          `${p.name}: expected secondary ${expected}, got ${p.secondaryPosition}`
        );
      }
    } else if (p.secondaryPosition) {
      fakeSecondary++;
      bugs.push(
        `${p.name}: should have no secondary, got ${p.secondaryPosition} (positions=${JSON.stringify(raw.positions)})`
      );
    }
  }

  ok.push(`imported ${imported} real players into Wigan career universe`);
  ok.push(`correct duals ${withSecondary}`);
  if (wrongSecondary === 0) ok.push("no wrong secondaries");
  if (fakeSecondary === 0) ok.push("no fake secondaries on single-pos players");

  // Known cases
  const cust = Object.values(byId).find((p) => p.name === "Cade Cust");
  if (cust) {
    const badge = formatPositionPair(cust.position, cust.secondaryPosition);
    if (badge === "HB/HK" || badge === "HK/HB") ok.push(`Cade Cust ${badge}`);
    else bugs.push(`Cade Cust badge=${badge} sec=${cust.secondaryPosition}`);
  }
  const rouge = Object.values(byId).find((p) => p.name.includes("Roug"));
  if (rouge) {
    if (!rouge.secondaryPosition && formatPositionShort(rouge.position) === "HB") {
      ok.push(`${rouge.name} HB only (no SO/SH dual)`);
    } else {
      bugs.push(
        `${rouge.name} sec=${rouge.secondaryPosition} pair=${formatPositionPair(rouge.position, rouge.secondaryPosition)}`
      );
    }
  }

  console.log(JSON.stringify({ ok, bugs, examples }, null, 2));
  if (bugs.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
