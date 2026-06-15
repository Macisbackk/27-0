/**
 * Backfill birthYear on players (and birth-years.json) from dateOfBirth.
 * Run: npx tsx scripts/backfill-birth-years-from-dob.ts
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import birthYearsData from "../data/birth-years.json";
import { birthYearFromDob } from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const BIRTH_YEARS_PATH = join(DATA_DIR, "birth-years.json");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

type RawPlayer = {
  id: string;
  dateOfBirth?: string;
  birthYear?: number;
  availableInGame?: boolean;
};

function isSkipped(player: RawPlayer): boolean {
  if (player.availableInGame === false) return true;
  if (player.id === "jm-goat-joe-mellor") return true;
  if (player.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
}

function main() {
  const existing = { ...(birthYearsData as Record<string, number>) };
  let playerUpdates = 0;
  let sidecarAdds = 0;

  for (const file of FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
    let changed = false;

    for (const player of players) {
      if (isSkipped(player) || !player.dateOfBirth || player.birthYear) continue;
      const by = birthYearFromDob(player.dateOfBirth);
      if (!by) continue;
      player.birthYear = by;
      playerUpdates++;
      changed = true;

      const baseId = player.id.replace(/-\d{4}$/, "");
      if (existing[player.id] === undefined && existing[baseId] === undefined) {
        existing[player.id] = by;
        sidecarAdds++;
      }
    }

    if (changed) writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
    console.log(`${file}: ${changed ? "updated" : "unchanged"}`);
  }

  const sorted = Object.fromEntries(
    Object.entries(existing).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(BIRTH_YEARS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `Backfilled ${playerUpdates} player birthYear(s), ${sidecarAdds} new sidecar entries.`
  );
}

main();
