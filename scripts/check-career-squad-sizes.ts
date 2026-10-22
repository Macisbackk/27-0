/**
 * Manager Mode sanity check: build the 2026 world and print every club's
 * starting squad size (real + generated depth) against SQUAD_MIN / SQUAD_MAX.
 * Fails if any club starts outside the limits.
 *
 * Run: bun scripts/check-career-squad-sizes.ts
 */
import { buildWorld } from "../src/lib/career/world";
import { SQUAD_MAX, SQUAD_MIN } from "../src/lib/career/players";

const { clubs, players } = buildWorld("squad-size-check");
let bad = 0;
for (const club of Object.values(clubs).sort((a, b) => a.division.localeCompare(b.division) || a.name.localeCompare(b.name))) {
  const real = club.squad.filter((id) => players[id]?.real).length;
  const total = club.squad.length;
  const flag = total < SQUAD_MIN || total > SQUAD_MAX ? "  <-- outside limits" : "";
  if (flag) bad++;
  console.log(`${club.division.padEnd(12)} ${club.name.padEnd(24)} real ${String(real).padStart(2)}  total ${String(total).padStart(2)}${flag}`);
}
console.log(`SQUAD_MIN ${SQUAD_MIN}, SQUAD_MAX ${SQUAD_MAX}; clubs outside limits: ${bad}`);
if (bad > 0) process.exit(1);
