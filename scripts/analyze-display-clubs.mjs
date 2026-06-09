import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clubs = JSON.parse(readFileSync(join(root, "data/clubs.json"), "utf8"));
const activeNames = new Set(
  clubs.filter((c) => c.active).map((c) => c.name)
);
const activeIds = new Set(
  clubs.filter((c) => c.active).map((c) => c.id)
);

const sources = [
  "current-squads.json",
  "historic-players.json",
  "legends.json",
];

const all = [];
for (const file of sources) {
  const data = JSON.parse(readFileSync(join(root, "data", file), "utf8"));
  for (const p of data) all.push(p);
}

const legends = JSON.parse(
  readFileSync(join(root, "data/legends.json"), "utf8")
);
const legendClubByName = new Map(
  legends.map((l) => [l.name, l.club])
);

const nonSL = all.filter((p) => !activeNames.has(p.club));
const byClub = {};
for (const p of nonSL) {
  byClub[p.club] = (byClub[p.club] ?? 0) + 1;
}

console.log("Non-SL players:", nonSL.length);
console.log(byClub);

const overrides = {};
for (const p of nonSL) {
  const legendClub = legendClubByName.get(p.name);
  if (legendClub && activeNames.has(legendClub)) {
    overrides[p.id] = legendClub;
    continue;
  }
}

writeFileSync(
  join(root, "data/player-super-league-club-overrides.json"),
  JSON.stringify(overrides, null, 2) + "\n"
);
console.log("Auto overrides from legends:", Object.keys(overrides).length);
