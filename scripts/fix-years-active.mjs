/**
 * Normalise and correct Years Active across player JSON files.
 * Run: node scripts/fix-years-active.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Verified career span corrections by player id */
const CAREER_CORRECTIONS = {
  "robbie-paul": "1994–2011",
  "bradford-hist-robbie-paul": "1994–2011",
  "leon-pryce": "1999–2017",
  "bradford-hist-leon-pryce": "1999–2017",
  "sam-burgess": "2007–2020",
  "kevin-sinfield": "1997–2015",
  "bradford-cur-joe-mellor": "2011–Present",
  "daryl-clark": "2011–Present",
  "jermaine-mcgillvary": "2010–Present",
  "josh-charnley": "2010–Present",
  "ryan-hall": "2007–Present",
};

const FILES = [
  "data/current-squads.json",
  "data/historic-players.json",
  "data/legends.json",
];

function normalizeYearsActive(raw, player) {
  if (CAREER_CORRECTIONS[player.id]) {
    return CAREER_CORRECTIONS[player.id];
  }

  let ya = String(raw ?? "").trim();
  if (!ya) return ya;

  ya = ya.replace(/-/g, "–");

  if (ya.includes("2026")) {
    if (player.category === "current") {
      ya = ya.replace("2026", "Present");
    } else {
      ya = ya.replace("2026", "2025");
    }
  }

  if (ya.endsWith("–Present") || ya.includes("Present")) {
    return ya.replace(/present/i, "Present");
  }

  return ya;
}

let totalFixed = 0;
const corrections = [];

for (const rel of FILES) {
  const filePath = path.join(root, rel);
  const players = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let fileFixed = 0;

  for (const player of players) {
    const before = player.yearsActive;
    const after = normalizeYearsActive(before, player);
    if (after && after !== before) {
      corrections.push({
        file: rel,
        id: player.id,
        name: player.name,
        before,
        after,
      });
      player.yearsActive = after;
      fileFixed++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(players, null, 2) + "\n");
  totalFixed += fileFixed;
  console.log(`${rel}: ${fileFixed} records updated`);
}

console.log(`\nTotal corrections: ${totalFixed}`);
if (corrections.length > 0) {
  console.log("\nSample corrections:");
  corrections.slice(0, 15).forEach((c) => {
    console.log(`  ${c.name} (${c.id}): ${c.before} → ${c.after}`);
  });
}
