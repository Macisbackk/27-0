import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const legends = JSON.parse(
  readFileSync(join(root, "data/legends.json"), "utf8")
);

let corrections = {};
try {
  corrections = JSON.parse(
    readFileSync(join(root, "data/career-tries-corrections.json"), "utf8")
  );
} catch {
  corrections = {};
}

const verified = {};

for (const player of legends) {
  if (typeof player.tries === "number" && player.tries >= 0) {
    verified[player.id] = player.tries;
  }
}

for (const [id, tries] of Object.entries(corrections)) {
  if (typeof tries === "number" && tries >= 0) {
    verified[id] = tries;
  }
}

writeFileSync(
  join(root, "data/career-tries-verified.json"),
  JSON.stringify(verified, null, 2) + "\n"
);

console.log(`Verified career tries: ${Object.keys(verified).length}`);
