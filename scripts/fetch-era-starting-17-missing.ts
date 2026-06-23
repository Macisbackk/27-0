/**
 * Second-pass fetch for missing Era Mode historic starting 17s from Rugby League Project.
 * Reads data/historic_starting_17_unresolved.txt, discovers team pages from season listings,
 * extracts "Most used players by position" 1–17, merges into era-starting-17s.json.
 *
 * Run: npm run fetch:era-starting-17-missing
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  type EraStarting17Entry,
  type FetchReportRow,
  type MissingReason,
  detailUrlFromSummary,
  extractSeasonTeamLinks,
  fetchRlpHtml,
  isCompleteSquad,
  matchClubToTeamLink,
  parseStarting17FromDetailHtml,
  parseUnresolvedLine,
  RLP_BASE,
  seasonSlugForYear,
  shouldIncludeClubYear,
} from "./lib/era-rlp-fetch";

const ROOT = join(process.cwd());
const DATA_DIR = join(ROOT, "data");
const UNRESOLVED_PATH = join(DATA_DIR, "historic_starting_17_unresolved.txt");
const EXISTING_PATH = join(DATA_DIR, "era-starting-17s.json");
const SECOND_PASS_PATH = join(DATA_DIR, "era-starting-17s-second-pass.json");
const REPORT_PATH = join(DATA_DIR, "era-starting-17s-second-pass-report.json");
const STILL_MISSING_PATH = join(DATA_DIR, "era-starting-17s-still-missing.json");

const REQUEST_DELAY_MS = 280;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadExisting(): EraStarting17Entry[] {
  return JSON.parse(readFileSync(EXISTING_PATH, "utf8")) as EraStarting17Entry[];
}

function entryKey(club: string, year: number): string {
  return `${club}|${year}`;
}

async function getSeasonTeams(
  year: number,
  cache: Map<number, ReturnType<typeof extractSeasonTeamLinks>>
) {
  if (cache.has(year)) return cache.get(year)!;

  const seasonSlug = seasonSlugForYear(year);
  const summaryPath = `/seasons/${seasonSlug}/summary.html`;
  await sleep(REQUEST_DELAY_MS);
  const html = await fetchRlpHtml(summaryPath);
  const teams = html ? extractSeasonTeamLinks(html, seasonSlug) : [];
  cache.set(year, teams);
  return teams;
}

async function fetchClubYear(
  club: string,
  year: number,
  seasonCache: Map<number, ReturnType<typeof extractSeasonTeamLinks>>
): Promise<{
  entry: EraStarting17Entry | null;
  report: FetchReportRow;
}> {
  if (!shouldIncludeClubYear(club, year)) {
    return {
      entry: null,
      report: {
        club,
        year,
        status: "skipped_not_sl",
        reason: "not a Super League season for that club",
      },
    };
  }

  const teams = await getSeasonTeams(year, seasonCache);
  if (teams.length === 0) {
    return {
      entry: null,
      report: {
        club,
        year,
        status: "failed",
        reason: "not found on Rugby League Project",
        detail: `No Super League season page for ${year}`,
      },
    };
  }

  const team = matchClubToTeamLink(club, teams);
  if (!team) {
    return {
      entry: null,
      report: {
        club,
        year,
        status: "failed",
        reason: "not found on Rugby League Project",
        detail: `Club not listed on ${seasonSlugForYear(year)} season page`,
      },
    };
  }

  const detailPath = detailUrlFromSummary(team.summaryPath);
  await sleep(REQUEST_DELAY_MS);
  const detailHtml = await fetchRlpHtml(detailPath);
  const sourceUrl = `${RLP_BASE}${detailPath}`;

  if (!detailHtml) {
    return {
      entry: null,
      report: {
        club,
        year,
        status: "failed",
        reason: "not found on Rugby League Project",
        teamUrl: sourceUrl,
        detail: "Team detail page unavailable",
      },
    };
  }

  const squad = parseStarting17FromDetailHtml(detailHtml);
  if (!squad) {
    const partial = detailHtml.includes("Season Player Summary");
    return {
      entry: null,
      report: {
        club,
        year,
        status: "failed",
        reason: partial ? "page found but no complete 1–17" : "parsing failed",
        teamUrl: sourceUrl,
        detail: partial
          ? "Detail page loaded but 1–17 most-used lineup incomplete"
          : "Could not locate Season Player Summary section",
      },
    };
  }

  return {
    entry: {
      club,
      year,
      source: sourceUrl,
      squad,
    },
    report: {
      club,
      year,
      status: "success",
      teamUrl: sourceUrl,
      playersFound: squad.length,
    },
  };
}

function sortEntries(entries: EraStarting17Entry[]): EraStarting17Entry[] {
  return [...entries].sort((a, b) =>
    a.club === b.club ? b.year - a.year : a.club.localeCompare(b.club)
  );
}

async function main(): Promise<void> {
  const unresolvedText = readFileSync(UNRESOLVED_PATH, "utf8");
  const targets = unresolvedText
    .split(/\r?\n/)
    .map(parseUnresolvedLine)
    .filter((row): row is { club: string; year: number } => row !== null);

  const existing = loadExisting();
  const existingKeys = new Set(
    existing.map((entry) => entryKey(entry.club, entry.year))
  );

  const seasonCache = new Map<number, ReturnType<typeof extractSeasonTeamLinks>>();
  const fetched: EraStarting17Entry[] = [];
  const reportRows: FetchReportRow[] = [];
  const stillMissing: {
    club: string;
    year: number;
    reason: MissingReason;
    detail?: string;
    teamUrl?: string;
  }[] = [];

  console.log(
    `[era-starting-17-missing] Processing ${targets.length} unresolved club-years…`
  );

  for (let i = 0; i < targets.length; i++) {
    const { club, year } = targets[i];
    const key = entryKey(club, year);

    if (existingKeys.has(key)) {
      reportRows.push({ club, year, status: "skipped_existing" });
      continue;
    }

    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`  [${i + 1}/${targets.length}] ${club} ${year}`);
    }

    const { entry, report } = await fetchClubYear(club, year, seasonCache);
    reportRows.push(report);

    if (entry && isCompleteSquad(entry.squad)) {
      fetched.push(entry);
      existingKeys.add(key);
    } else if (report.status !== "skipped_existing") {
      stillMissing.push({
        club,
        year,
        reason: report.reason ?? "parsing failed",
        detail: report.detail,
        teamUrl: report.teamUrl,
      });
    }
  }

  const merged = sortEntries([...existing, ...fetched]);
  writeFileSync(EXISTING_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  writeFileSync(SECOND_PASS_PATH, `${JSON.stringify(sortEntries(fetched), null, 2)}\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    unresolvedRequested: targets.length,
    skippedExisting: reportRows.filter((r) => r.status === "skipped_existing")
      .length,
    skippedNotSuperLeague: reportRows.filter((r) => r.status === "skipped_not_sl")
      .length,
    fetchedSuccessfully: fetched.length,
    stillMissingCount: stillMissing.length,
    byClub: Object.fromEntries(
      [...new Set(fetched.map((e) => e.club))].map((club) => [
        club,
        fetched.filter((e) => e.club === club).length,
      ])
    ),
    rows: reportRows,
  };

  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    STILL_MISSING_PATH,
    `${JSON.stringify(
      {
        generatedAt: report.generatedAt,
        count: stillMissing.length,
        entries: stillMissing.sort((a, b) =>
          a.club === b.club ? a.year - b.year : a.club.localeCompare(b.club)
        ),
      },
      null,
      2
    )}\n`
  );

  console.log(`\n[era-starting-17-missing] Second pass complete`);
  console.log(`  New squads fetched: ${fetched.length}`);
  console.log(`  Merged total in era-starting-17s.json: ${merged.length}`);
  console.log(`  Still missing: ${stillMissing.length}`);
  console.log(`  → ${SECOND_PASS_PATH}`);
  console.log(`  → ${REPORT_PATH}`);
  console.log(`  → ${STILL_MISSING_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
