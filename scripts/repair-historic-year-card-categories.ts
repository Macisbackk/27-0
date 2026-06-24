/** Fix year cards in historic-players.json that were cloned with category=current. */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(process.cwd(), "data");
const CURRENT_YEAR = 2026;
const historic = JSON.parse(
  readFileSync(join(DATA, "historic-players.json"), "utf-8")
) as Array<Record<string, unknown>>;

let fixed = 0;
for (const p of historic) {
  const year = p.year as number | undefined;
  if (year !== undefined && year < CURRENT_YEAR && p.category === "current") {
    p.category = "historic";
    p.status = "Historic";
    fixed++;
  }
}

writeFileSync(
  join(DATA, "historic-players.json"),
  `${JSON.stringify(historic, null, 2)}\n`
);
console.log(`Fixed ${fixed} historic year cards misclassified as current`);
