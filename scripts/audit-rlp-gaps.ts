/**
 * One-off audit: count eligible players with missing/Unknown fields.
 * Run: npx tsx scripts/audit-rlp-gaps.ts
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { buildRlpIdMap, nameKey } from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

type RawPlayer = {
  id: string;
  name: string;
  nationality: string;
  yearsActive?: string;
  position?: string;
  primaryPosition?: string;
  dateOfBirth?: string;
  birthYear?: number;
  tries?: number;
  clubsPlayedFor?: string[];
  representativeTeams?: string[];
  availableInGame?: boolean;
};

function isSkipped(p: RawPlayer): boolean {
  if (p.availableInGame === false) return true;
  if (p.id === "jm-goat-joe-mellor") return true;
  if (p.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
}

function main() {
  const idMap = existsSync(HTML_PATH)
    ? buildRlpIdMap(readFileSync(HTML_PATH, "utf-8"))
    : new Map<string, string>();

  const cacheFiles = existsSync(CACHE_DIR)
    ? readdirSync(CACHE_DIR).filter((f) => f.endsWith(".html")).length
    : 0;

  const counts = {
    eligible: 0,
    unknownNationality: 0,
    unknownYearsActive: 0,
    missingTries: 0,
    missingPosition: 0,
    missingDob: 0,
    missingBirthYear: 0,
    emptyClubs: 0,
    emptyRepTeams: 0,
    noRlpMatch: 0,
    noCache: 0,
  };

  const samples: Record<string, string[]> = {
    unknownNationality: [],
    unknownYearsActive: [],
    missingTries: [],
    missingPosition: [],
    missingBirthYear: [],
    noRlpMatch: [],
  };

  for (const file of FILES) {
    const players = JSON.parse(
      readFileSync(join(DATA_DIR, file), "utf-8")
    ) as RawPlayer[];
    for (const p of players) {
      if (isSkipped(p)) continue;
      counts.eligible++;

      const key = nameKey(p.name);
      const rlpId = idMap.get(key);
      if (!rlpId) {
        counts.noRlpMatch++;
        if (samples.noRlpMatch.length < 15) samples.noRlpMatch.push(`${p.name} (${p.id})`);
      } else if (!existsSync(join(CACHE_DIR, `${rlpId}.html`))) {
        counts.noCache++;
      }

      if (!p.nationality || p.nationality === "Unknown") {
        counts.unknownNationality++;
        if (samples.unknownNationality.length < 15)
          samples.unknownNationality.push(`${p.name} (${p.id})`);
      }
      if (!p.yearsActive || p.yearsActive === "Unknown" || p.yearsActive.endsWith("–Unknown")) {
        counts.unknownYearsActive++;
        if (samples.unknownYearsActive.length < 15)
          samples.unknownYearsActive.push(`${p.name} (${p.id})`);
      }
      if (p.tries === undefined || p.tries === null) {
        counts.missingTries++;
        if (samples.missingTries.length < 15)
          samples.missingTries.push(`${p.name} (${p.id})`);
      }
      if (
        (!p.position || p.position.toLowerCase() === "unknown") &&
        !p.primaryPosition
      ) {
        counts.missingPosition++;
        if (samples.missingPosition.length < 15)
          samples.missingPosition.push(`${p.name} (${p.id})`);
      }
      if (!p.dateOfBirth) counts.missingDob++;
      if (!p.birthYear) {
        counts.missingBirthYear++;
        if (samples.missingBirthYear.length < 15)
          samples.missingBirthYear.push(`${p.name} (${p.id})`);
      }
      if (!p.clubsPlayedFor || p.clubsPlayedFor.length === 0) counts.emptyClubs++;
      if (!p.representativeTeams || p.representativeTeams.length === 0)
        counts.emptyRepTeams++;
    }
  }

  console.log(JSON.stringify({ counts, cacheFiles, rlpListExists: existsSync(HTML_PATH), samples }, null, 2));
}

main();
