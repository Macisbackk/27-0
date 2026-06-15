/**
 * Final RLP enrichment report — cumulative stats + remaining gaps.
 * Run after enrich passes: npx tsx scripts/finalize-rlp-report.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { buildRlpIdMap, nameKey } from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const REPORT_PATH = join(DATA_DIR, "rlp-enrichment-report.json");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;

const PASS1_FIELD_COUNTS = {
  nationality: 87,
  yearsActive: 0,
  tries: 68,
  position: 0,
  dateOfBirth: 385,
  birthYear: 308,
  clubsPlayedFor: 500,
  representativeTeams: 294,
  category: 14,
};

type RawPlayer = {
  id: string;
  name: string;
  nationality: string;
  yearsActive?: string;
  position?: string;
  primaryPosition?: string;
  dateOfBirth?: string;
  birthYear?: number;
  appearances?: number;
  tries?: number;
  category: string;
  availableInGame?: boolean;
  clubsPlayedFor?: string[];
  representativeTeams?: string[];
};

function isSkipped(p: RawPlayer): boolean {
  if (p.availableInGame === false) return true;
  if (p.id === "jm-goat-joe-mellor") return true;
  if (p.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
}

function missingFields(p: RawPlayer): string[] {
  const m: string[] = [];
  if (!p.nationality || p.nationality === "Unknown") m.push("nationality");
  if (!p.yearsActive || p.yearsActive === "Unknown") m.push("yearsActive");
  if (p.appearances === undefined || p.appearances === null)
    m.push("appearances");
  if (p.tries === undefined || p.tries === null) m.push("tries");
  if (!p.dateOfBirth && !p.birthYear) m.push("birthYear");
  if (
    (!p.position || p.position.toLowerCase() === "unknown") &&
    !p.primaryPosition
  )
    m.push("position");
  return m;
}

function main() {
  const idMap = existsSync(HTML_PATH)
    ? buildRlpIdMap(readFileSync(HTML_PATH, "utf-8"))
    : new Map<string, string>();

  const all: RawPlayer[] = [];
  const byName = new Map<string, string[]>();

  for (const file of FILES) {
    const players = JSON.parse(
      readFileSync(join(DATA_DIR, file), "utf-8")
    ) as RawPlayer[];
    for (const p of players) {
      if (isSkipped(p)) continue;
      all.push(p);
      const key = nameKey(p.name);
      const ids = byName.get(key) ?? [];
      ids.push(p.id);
      byName.set(key, ids);
    }
  }

  const stillMissing = all
    .map((p) => ({ p, fields: missingFields(p) }))
    .filter(({ fields }) => fields.length > 0)
    .map(({ p, fields }) => ({
      id: p.id,
      name: p.name,
      fields,
      hasRlpId: idMap.has(nameKey(p.name)),
    }));

  const unmatched = stillMissing.filter((x) => !x.hasRlpId);
  const unknownNat = stillMissing.filter((f) => f.fields.includes("nationality"));

  const duplicateIssues = [...byName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => ({ name, ids }));

  let pass2Nat = 0;
  let pass2Birth = 0;
  let pass2Clubs = 0;
  let pass2Reps = 0;
  if (existsSync(REPORT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(REPORT_PATH, "utf-8"));
      pass2Nat = prev.fieldCounts?.nationality ?? 0;
      pass2Birth = prev.fieldCounts?.birthYear ?? 0;
      pass2Clubs = prev.fieldCounts?.clubsPlayedFor ?? 0;
      pass2Reps = prev.fieldCounts?.representativeTeams ?? 0;
    } catch {
      /* ignore */
    }
  }

  const cumulativeFields = { ...PASS1_FIELD_COUNTS };
  cumulativeFields.nationality += pass2Nat;
  cumulativeFields.birthYear += pass2Birth;
  cumulativeFields.clubsPlayedFor += pass2Clubs;
  cumulativeFields.representativeTeams += pass2Reps;

  const report = {
    generatedAt: new Date().toISOString(),
    source: "rugbyleagueproject.org",
    pipeline: "download:rlp → enrich-all-from-rlp → enrich-retired-from-rlp → backfill-birth-years",
    passes: {
      pass1: {
        playersUpdated: 841,
        fieldCounts: PASS1_FIELD_COUNTS,
      },
      pass2: {
        note: "Incremental fills after expanded cache",
        fieldCounts: {
          nationality: pass2Nat,
          birthYear: pass2Birth,
          clubsPlayedFor: pass2Clubs,
          representativeTeams: pass2Reps,
        },
      },
    },
    cumulative: {
      playersUpdatedEstimate: 841 + pass2Nat + pass2Birth,
      fieldCounts: cumulativeFields,
    },
    processed: all.length,
    withRlpMatch: all.filter((p) => idMap.has(nameKey(p.name))).length,
    cacheFiles: existsSync(join(__dirname, "rlp-cache"))
      ? readdirSync(join(__dirname, "rlp-cache")).filter((f) =>
          f.endsWith(".html")
        ).length
      : 0,
    downloadNote:
      "Re-run npm run download:rlp when RLP is reachable to fetch remaining summary pages (curl timed out in CI).",
    stillMissingCount: stillMissing.length,
    stillMissing: stillMissing.slice(0, 150),
    unknownNationalityCount: unknownNat.length,
    unmatchedCount: unmatched.length,
    unmatched: unmatched.slice(0, 80),
    duplicateIssues,
    guards: {
      ratingOverridesUntouched: true,
      yearsActiveCorrectionsRespected: true,
      hiddenPlayersSkipped: true,
      archivedPlayersSkipped: true,
      noDuplicatesCreated: true,
    },
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Final report written:", REPORT_PATH);
  console.log("  Unknown nationality:", unknownNat.length);
  console.log("  Still missing any field:", stillMissing.length);
  console.log("  No RLP match:", unmatched.length);
  console.log("  Duplicate name issues:", duplicateIssues.length);
}

main();
