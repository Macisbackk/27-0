/**
 * The sliced registry build (/play on phones) must give exactly the same registry as the
 * one-shot build every other page uses.
 * Run: npx tsx scripts/test-player-registry-slices.ts
 */
import { isDeepStrictEqual } from "node:util";
import { buildPlayerRegistry, buildPlayerRegistryInSlices } from "../src/lib/players/registry";
import { getSyncRawPlayerRows } from "../src/lib/players/sync-bootstrap";

async function main() {
  const raw = getSyncRawPlayerRows();
  const oneShot = buildPlayerRegistry(raw.current, raw.historic, raw.legends);
  let yields = 0;
  const sliced = await buildPlayerRegistryInSlices(raw.current, raw.historic, raw.legends, async () => {
    yields += 1;
  });
  const checks: [string, boolean][] = [
    ["same pool", isDeepStrictEqual(oneShot.all, sliced.all)],
    ["same current", isDeepStrictEqual(oneShot.current, sliced.current)],
    ["same historic", isDeepStrictEqual(oneShot.historic, sliced.historic)],
    ["same legends", isDeepStrictEqual(oneShot.legends, sliced.legends)],
    ["same byId", isDeepStrictEqual([...oneShot.byId.entries()], [...sliced.byId.entries()])],
    ["yields between slices", yields > 10],
    ["pool not empty", sliced.all.length > 1000],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
    if (!ok) failed += 1;
  }
  console.log(`${sliced.all.length} cards, ${yields} slices`);
  if (failed) process.exit(1);
}

void main();
