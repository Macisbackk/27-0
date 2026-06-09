/**
 * Enrich Unknown nationalities from Wikipedia (rugby league players only).
 * Uses MediaWiki opensearch + extracts; applies when rugby league is mentioned and nationality is explicit.
 * Run: npx tsx scripts/enrich-wikipedia-nationality.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const TARGET_FILES = ["historic-players.json", "legends.json"] as const;
const DELAY_MS = 800;
const RETRY_DELAY_MS = 5000;
const USER_AGENT = "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

const ADJECTIVE_TO_COUNTRY: Record<string, string> = {
  australian: "Australia",
  english: "England",
  welsh: "Wales",
  scottish: "Scotland",
  irish: "Ireland",
  french: "France",
  samoan: "Samoa",
  tongan: "Tonga",
  fijian: "Fiji",
  lebanese: "Lebanon",
  italian: "Italy",
  jamaican: "Jamaica",
  serbian: "Serbia",
  greek: "Greece",
  "new zealand": "New Zealand",
  "new zealander": "New Zealand",
  "papua new guinean": "Papua New Guinea",
  "cook island": "Cook Islands",
  "cook islands": "Cook Islands",
};

const COUNTRY_NAMES = [
  "New Zealand",
  "Papua New Guinea",
  "Cook Islands",
  "Australia",
  "England",
  "Wales",
  "Scotland",
  "Ireland",
  "France",
  "Samoa",
  "Tonga",
  "Fiji",
  "Lebanon",
  "Italy",
  "Jamaica",
  "Serbia",
  "Greece",
];

type WikiPage = {
  title?: string;
  description?: string;
  extract?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyMatch(title: string, playerName: string): boolean {
  const titleNorm = normalizeForMatch(title);
  const nameNorm = normalizeForMatch(playerName);
  if (titleNorm === nameNorm) return true;

  const parts = nameNorm.split(" ").filter((p) => p.length > 1);
  if (parts.length === 0) return false;
  const surname = parts[parts.length - 1];
  if (!titleNorm.includes(surname)) return false;
  if (parts.length === 1) return true;
  return titleNorm.includes(parts[0]);
}

function countryFromPhrase(phrase: string): string | null {
  const lower = phrase.toLowerCase().trim();
  for (const country of COUNTRY_NAMES) {
    if (lower === country.toLowerCase() || lower.startsWith(country.toLowerCase())) {
      return country;
    }
  }
  return ADJECTIVE_TO_COUNTRY[lower] ?? null;
}

function mentionsRugbyLeague(page: WikiPage): boolean {
  const text = `${page.title ?? ""} ${page.description ?? ""} ${page.extract ?? ""}`.toLowerCase();
  return text.includes("rugby league") || text.includes("rugby footballer");
}

function parseNationality(page: WikiPage): string | null {
  const combined = `${page.description ?? ""} ${page.extract ?? ""}`;

  const patterns: RegExp[] = [
    /^(.+?)\s+international\s+rugby\s+league/i,
    /^(.+?)\s+rugby\s+league\s+footballer/i,
    /^(.+?)\s+rugby\s+league\s+player/i,
    /is an?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:former\s+|current\s+|professional\s+)?rugby\s+league/i,
    /is an?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+rugby\s+league\s+footballer/i,
    /born in\s+([^,.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (!match) continue;
    const phrase = match[1].split(/\s+and\s+/i)[0]?.trim();
    if (!phrase) continue;
    const country = countryFromPhrase(phrase);
    if (country) return country;
  }

  return null;
}

async function wikiGet<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries({ format: "json", origin: "*", ...params })) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (res.status === 429) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    const text = await res.text();
    if (text.startsWith("<!") || text.includes("too many requests")) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    return JSON.parse(text) as T;
  }
  return null;
}

async function searchTitle(name: string): Promise<string | null> {
  const data = await wikiGet<[string, string[]]>({
    action: "opensearch",
    search: name,
    limit: "5",
    namespace: "0",
  });
  if (!data) return null;

  const titles = data[1] ?? [];
  for (const title of titles) {
    if (namesLikelyMatch(title, name)) return title;
  }
  return titles[0] && namesLikelyMatch(titles[0], name) ? titles[0] : null;
}

async function fetchPage(title: string): Promise<WikiPage | null> {
  type QueryResult = {
    query?: {
      pages?: Record<
        string,
        { title?: string; description?: string; extract?: string; missing?: string }
      >;
    };
  };

  const data = await wikiGet<QueryResult>({
    action: "query",
    titles: title,
    prop: "description|extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
  });
  if (!data?.query?.pages) return null;

  const page = Object.values(data.query.pages).find((p) => !p.missing);
  if (!page) return null;

  return {
    title: page.title,
    description: page.description,
    extract: page.extract,
  };
}

async function resolveNationality(playerName: string): Promise<string | null> {
  const title = await searchTitle(playerName);
  if (!title) return null;

  const page = await fetchPage(title);
  if (!page || !mentionsRugbyLeague(page)) return null;

  return parseNationality(page);
}

async function main() {
  let updated = 0;
  let scanned = 0;
  let noMatch = 0;

  for (const file of TARGET_FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as {
      name: string;
      nationality: string;
    }[];
    const targets = players.filter((p) => p.nationality === "Unknown");
    console.log(`\n${file}: ${targets.length} with Unknown nationality`);

    let fileChanged = false;
    for (const player of targets) {
      scanned++;
      const nat = await resolveNationality(player.name);
      await sleep(DELAY_MS);

      if (!nat) {
        noMatch++;
        continue;
      }

      player.nationality = nat;
      updated++;
      fileChanged = true;

      if (updated % 25 === 0) {
        console.log(`  Updated ${updated} so far…`);
        writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
      }
    }

    if (fileChanged) {
      writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
    }
    console.log(`  Saved ${file}`);
  }

  console.log("\nWikipedia nationality enrichment:");
  console.log(`  Scanned: ${scanned}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  No reliable match: ${noMatch}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
