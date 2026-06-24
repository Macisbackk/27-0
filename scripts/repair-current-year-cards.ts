/** One-off repair after year-card migration — restore current player classification. */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(process.cwd(), "data");
const current = JSON.parse(
  readFileSync(join(DATA, "current-squads.json"), "utf-8")
) as Array<Record<string, unknown>>;

let fixed = 0;
for (const p of current) {
  if (!String(p.yearsActive ?? "").includes("Present")) {
    p.yearsActive = "2026–Present";
    fixed++;
  }
  delete p.availableInGame;
}

writeFileSync(
  join(DATA, "current-squads.json"),
  `${JSON.stringify(current, null, 2)}\n`
);
console.log(`Repaired ${fixed} current player yearsActive values`);
