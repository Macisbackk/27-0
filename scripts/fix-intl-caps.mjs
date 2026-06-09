/**
 * Normalise international caps across player JSON files.
 * Run: node scripts/fix-intl-caps.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const corrections = JSON.parse(
  fs.readFileSync(path.join(root, "data/intl-caps-corrections.json"), "utf8")
);

const FILES = [
  "data/current-squads.json",
  "data/historic-players.json",
  "data/legends.json",
];

let totalFixed = 0;

for (const rel of FILES) {
  const filePath = path.join(root, rel);
  const players = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let fileFixed = 0;

  for (const player of players) {
    const before = player.intlCaps;
    if (corrections[player.id] !== undefined) {
      player.intlCaps = corrections[player.id];
    } else if (player.intlCaps === undefined || player.intlCaps === null) {
      player.intlCaps = 0;
    } else {
      player.intlCaps = Math.max(0, Math.round(player.intlCaps));
    }

    if (before !== player.intlCaps) {
      fileFixed++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(players, null, 2) + "\n");
  totalFixed += fileFixed;
  console.log(`${rel}: ${fileFixed} records updated`);
}

console.log(`\nTotal corrections: ${totalFixed}`);
