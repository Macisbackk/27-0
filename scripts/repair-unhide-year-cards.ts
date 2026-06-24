/** Remove availableInGame:false flags set during migration — pools filter generics instead. */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(process.cwd(), "data");

function unhide(file: string): number {
  const players = JSON.parse(readFileSync(join(DATA, file), "utf-8")) as Array<
    Record<string, unknown>
  >;
  let count = 0;
  for (const p of players) {
    if (p.availableInGame === false) {
      delete p.availableInGame;
      count++;
    }
  }
  writeFileSync(join(DATA, file), `${JSON.stringify(players, null, 2)}\n`);
  return count;
}

const historic = unhide("historic-players.json");
const legends = unhide("legends.json");
console.log(`Unhid ${historic} historic + ${legends} legend cards`);
