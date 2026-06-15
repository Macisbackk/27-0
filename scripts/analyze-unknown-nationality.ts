import { readFileSync } from "fs";
import { join } from "path";
import {
  buildRlpIdMap,
  nameKey,
  parsePlaceOfBirth,
  nationalityFromPlaceOfBirth,
  readCachedSummary,
} from "./lib/rlp-parse";

const DATA = ["current-squads.json", "historic-players.json", "legends.json"];
const idMap = buildRlpIdMap(readFileSync("scripts/rlp-players.html", "utf-8"));
const cacheDir = "scripts/rlp-cache";
const reasons = {
  noMatch: 0,
  noCache: 0,
  noPlace: 0,
  unmappedPlace: 0,
  cacheHasNatNotApplied: 0,
};
const unmappedSamples: string[] = [];
const notAppliedSamples: string[] = [];

for (const f of DATA) {
  const players = JSON.parse(readFileSync(join("data", f), "utf-8")) as {
    id: string;
    name: string;
    nationality: string;
    availableInGame?: boolean;
  }[];
  for (const p of players) {
    if (
      p.availableInGame === false ||
      p.id === "jm-goat-joe-mellor" ||
      p.id.startsWith("ssh-sam-hallas-")
    )
      continue;
    if (p.nationality !== "Unknown") continue;
    const id = idMap.get(nameKey(p.name));
    if (!id) {
      reasons.noMatch++;
      continue;
    }
    const html = readCachedSummary(cacheDir, id);
    if (!html) {
      reasons.noCache++;
      continue;
    }
    const place = parsePlaceOfBirth(html);
    if (!place) {
      reasons.noPlace++;
      continue;
    }
    const nat = nationalityFromPlaceOfBirth(place);
    if (!nat) {
      reasons.unmappedPlace++;
      if (unmappedSamples.length < 15)
        unmappedSamples.push(`${p.name}: ${place}`);
    } else {
      reasons.cacheHasNatNotApplied++;
      if (notAppliedSamples.length < 10)
        notAppliedSamples.push(`${p.name}: ${nat}`);
    }
  }
}

console.log(
  JSON.stringify({ reasons, unmappedSamples, notAppliedSamples }, null, 2)
);
