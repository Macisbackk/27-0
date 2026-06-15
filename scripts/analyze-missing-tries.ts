import { readFileSync } from "fs";
import { join } from "path";
import { nameKey, parseRlpList } from "./lib/rlp-parse";

const list = parseRlpList(readFileSync("scripts/rlp-players.html", "utf-8"));
let noMatch = 0;
let nullTries = 0;
let hasTries = 0;
const samples: string[] = [];

for (const f of ["current-squads.json", "historic-players.json", "legends.json"]) {
  const players = JSON.parse(readFileSync(join("data", f), "utf-8")) as {
    id: string;
    name: string;
    tries?: number;
    availableInGame?: boolean;
  }[];
  for (const p of players) {
    if (
      p.availableInGame === false ||
      p.id === "jm-goat-joe-mellor" ||
      p.id.startsWith("ssh-sam-hallas-")
    )
      continue;
    if (p.tries != null) continue;
    const row = list.get(nameKey(p.name));
    if (!row) {
      noMatch++;
      if (samples.length < 5) samples.push(`noMatch: ${p.name}`);
      continue;
    }
    if (row.tries === null) {
      nullTries++;
      if (samples.length < 8) samples.push(`null: ${p.name}`);
    } else {
      hasTries++;
      if (samples.length < 8) samples.push(`has: ${p.name}=${row.tries}`);
    }
  }
}

console.log(
  JSON.stringify(
    { noMatch, nullTries, hasTries, total: noMatch + nullTries + hasTries, samples },
    null,
    2
  )
);
