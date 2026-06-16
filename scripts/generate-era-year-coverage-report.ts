/**
 * Generates docs/era-year-coverage-report.md from team-year-rosters.json
 * Run: npx tsx scripts/generate-era-year-coverage-report.ts
 */
import fs from "fs";
import path from "path";
import teamYearRosters from "../data/team-year-rosters.json";
import clubsData from "../data/clubs.json";

const REPORT_CLUBS = [
  "Bradford Bulls",
  "Castleford Tigers",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Hull FC",
  "Hull KR",
  "Leeds Rhinos",
  "Leigh Leopards",
  "St Helens",
  "Toulouse Olympique",
  "Wakefield Trinity",
  "Warrington Wolves",
  "Wigan Warriors",
  "York Knights",
  "Salford Red Devils",
  "London Broncos",
  "Widnes Vikings",
] as const;

const UNSUPPORTED_REFERENCE_CLUBS = [
  "Paris Saint-Germain RL",
  "Gateshead Thunder",
  "Halifax Panthers",
  "Sheffield Eagles",
  "Oldham RLFC",
  "Crusaders RL",
  "Exiles",
];

type Rosters = Record<string, Record<string, string[]>>;

const rosters = teamYearRosters as Rosters;
const clubs = clubsData as {
  name: string;
  playable?: boolean;
  isCurrentSuperLeague?: boolean;
}[];

function isPlayable(name: string): boolean {
  const club = clubs.find((c) => c.name === name);
  return club?.playable === true || club?.isCurrentSuperLeague === true;
}

function getYears(club: string): number[] {
  const years = rosters[club];
  if (!years) return [];
  return Object.keys(years)
    .map(Number)
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
}

function findMissingNotableYears(years: number[]): number[] {
  if (years.length < 2) return [];
  const min = years[0]!;
  const max = years[years.length - 1]!;
  const set = new Set(years);
  const missing: number[] = [];
  for (let y = min; y <= max; y++) {
    if (!set.has(y)) missing.push(y);
  }
  return missing;
}

function squadSize(club: string, year: string): number {
  return rosters[club]?.[year]?.length ?? 0;
}

const lines: string[] = [
  "# Era Team Year Coverage Report",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "",
  "Source: `data/team-year-rosters.json`",
  "",
  "## Normal Mode slot spin pool",
  "",
  "Only teams with roster entries **and** `playable` / `isCurrentSuperLeague` in `clubs.json` appear in Normal Mode spins.",
  "",
];

const slotTeams = Object.keys(rosters)
  .filter((team) => isPlayable(team))
  .sort();

lines.push(`Slot-eligible teams (${slotTeams.length}): ${slotTeams.join(", ")}`);
lines.push("");

lines.push("## Club year coverage");
lines.push("");

for (const club of REPORT_CLUBS) {
  const years = getYears(club);
  const inRosters = club in rosters;
  const playable = isPlayable(club);

  lines.push(`### ${club}`);
  lines.push("");
  if (!inRosters) {
    lines.push("- **Status:** No roster data in team-year-rosters.json");
    lines.push("");
    continue;
  }

  lines.push(`- **Playable flag:** ${playable ? "yes" : "no (era/reference only)"}`);
  lines.push(`- **Available years:** ${years.length ? years.join(", ") : "none"}`);
  if (years.length) {
    lines.push(`- **Earliest:** ${years[0]}`);
    lines.push(`- **Latest:** ${years[years.length - 1]}`);
    const missing = findMissingNotableYears(years);
    if (missing.length) {
      lines.push(
        `- **Missing years between earliest/latest:** ${missing.join(", ")}`
      );
      const thin = missing.filter((y) => {
        const prev = String(y - 1);
        const next = String(y + 1);
        return (
          (rosters[club]?.[prev]?.length ?? 0) >= 10 ||
          (rosters[club]?.[next]?.length ?? 0) >= 10
        );
      });
      if (thin.length) {
        lines.push(
          `- **Notable gaps (adjacent years have 10+ players):** ${thin.join(", ")}`
        );
      }
    } else {
      lines.push("- **Missing years between earliest/latest:** none");
    }
    const thinYears = years.filter((y) => squadSize(club, String(y)) < 13);
    if (thinYears.length) {
      lines.push(
        `- **Years with fewer than 13 roster players:** ${thinYears.map((y) => `${y} (${squadSize(club, String(y))})`).join(", ")}`
      );
    }
  }
  lines.push("");
}

lines.push("## Unsupported / reference-only clubs");
lines.push("");
for (const club of UNSUPPORTED_REFERENCE_CLUBS) {
  const years = getYears(club);
  const inRosters = club in rosters;
  lines.push(
    `- **${club}:** ${inRosters ? `${years.length} roster years in data` : "not in team-year-rosters"}, playable=${isPlayable(club) ? "yes" : "no"} — **excluded from Normal Mode slot spin**`
  );
}
lines.push("");

const outPath = path.join(process.cwd(), "docs", "era-year-coverage-report.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath}`);
