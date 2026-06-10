const USER_AGENT = "27-0-player-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

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
};

export interface WikipediaPlayerData {
  title: string;
  nationality: string | null;
  yearsActive: string | null;
  appearances: number | null;
  tries: number | null;
  isRetired: boolean;
}

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

function parseBirthPlaceCountry(wikitext: string): string | null {
  const m = wikitext.match(/\| birth_place\s*=\s*([^\n|]+)/i);
  if (!m) return null;
  const place = m[1].replace(/\{\{[^}]+\}\}/g, " ").replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, "$1");
  for (const country of COUNTRY_NAMES) {
    if (place.toLowerCase().includes(country.toLowerCase())) return country;
  }
  if (/new south wales|queensland|victoria|western australia|south australia|tasmania|northern territory|australian capital territory/i.test(place)) {
    return "Australia";
  }
  return null;
}

function parseNationalityFromDescription(description: string): string | null {
  const patterns = [
    /^(.+?)\s+international\s+rugby\s+league/i,
    /^(.+?)\s+rugby\s+league\s+footballer/i,
    /^(.+?)\s+rugby\s+league\s+player/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match) continue;
    const country = countryFromPhrase(match[1].split(/\s+and\s+/i)[0]?.trim() ?? "");
    if (country) return country;
  }
  return null;
}

function parseClubRows(wikitext: string): Array<{
  club: string;
  yearStart: number | null;
  yearEnd: string | null;
  appearances: number;
  tries: number;
}> {
  const rows: ReturnType<typeof parseClubRows> = [];
  for (let i = 1; i <= 20; i++) {
    const club = wikitext.match(new RegExp(`\\| club${i}\\s*=\\s*([^\\n|]+)`, "i"))?.[1];
    if (!club) break;
    const cleanClub = club
      .replace(/\{\{nowrap\|([^}]+)\}\}/gi, "$1")
      .replace(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g, "$1")
      .trim();
    const yearStartRaw = wikitext.match(new RegExp(`\\| year${i}start\\s*=\\s*([^\\n|]+)`, "i"))?.[1]?.trim();
    const yearEndRaw = wikitext.match(new RegExp(`\\| year${i}end\\s*=\\s*([^\\n|]+)`, "i"))?.[1]?.trim();
    const appearances = Number(
      wikitext.match(new RegExp(`\\| appearances${i}\\s*=\\s*(\\d+)`, "i"))?.[1] ?? "0"
    );
    const tries = Number(
      wikitext.match(new RegExp(`\\| tries${i}\\s*=\\s*(\\d+)`, "i"))?.[1] ?? "0"
    );
    const yearStart = yearStartRaw ? Number(yearStartRaw.replace(/[^\d]/g, "")) : null;
    rows.push({
      club: cleanClub,
      yearStart: Number.isFinite(yearStart) ? yearStart : null,
      yearEnd: yearEndRaw ?? null,
      appearances,
      tries,
    });
  }
  return rows;
}

function buildYearsActive(rows: ReturnType<typeof parseClubRows>): string | null {
  const starts = rows.map((r) => r.yearStart).filter((y): y is number => y !== null);
  if (starts.length === 0) return null;
  const minStart = Math.min(...starts);
  const hasPresent = rows.some((r) => /present/i.test(r.yearEnd ?? ""));
  const ends = rows
    .filter((r) => r.yearEnd && !/present/i.test(r.yearEnd))
    .map((r) => Number(String(r.yearEnd).replace(/[^\d]/g, "")))
    .filter((y) => Number.isFinite(y) && y > 1900);
  const maxEnd = ends.length > 0 ? Math.max(...ends) : null;
  if (hasPresent) return `${minStart}–Present`;
  if (maxEnd) return `${minStart}–${maxEnd}`;
  return `${minStart}–`;
}

function mentionsRugbyLeague(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("rugby league") || lower.includes("rugby footballer");
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
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    return (await res.json()) as T;
  }
  return null;
}

async function searchTitle(name: string): Promise<string | null> {
  const data = await wikiGet<{ 1?: string[] }>({
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

async function fetchWikitext(title: string): Promise<{ title: string; wikitext: string; description: string } | null> {
  type ParseResult = {
    parse?: {
      title?: string;
      wikitext?: { "*": string };
    };
  };
  const data = await wikiGet<ParseResult>({
    action: "parse",
    page: title,
    prop: "wikitext|properties",
    ppprop: "disambiguation",
  });
  if (!data?.parse?.wikitext?.["*"]) return null;
  const descriptionData = await wikiGet<{
    query?: { pages?: Record<string, { description?: string }> };
  }>({
    action: "query",
    titles: title,
    prop: "description",
  });
  const description =
    Object.values(descriptionData?.query?.pages ?? {})[0]?.description ?? "";
  return {
    title: data.parse.title ?? title,
    wikitext: data.parse.wikitext["*"],
    description,
  };
}

export async function fetchWikipediaPlayer(
  playerName: string,
  options?: { currentClub?: string; isCurrent?: boolean }
): Promise<WikipediaPlayerData | null> {
  const title = await searchTitle(playerName);
  if (!title) return null;

  const page = await fetchWikitext(title);
  if (!page) return null;

  const combined = `${page.title} ${page.description} ${page.wikitext.slice(0, 500)}`;
  if (!mentionsRugbyLeague(combined)) return null;

  const rows = parseClubRows(page.wikitext);
  const retired = /retired\s*=\s*yes/i.test(page.wikitext) || !rows.some((r) => /present/i.test(r.yearEnd ?? ""));

  let nationality =
    parseNationalityFromDescription(page.description) ??
    parseBirthPlaceCountry(page.wikitext);

  const yearsActive = buildYearsActive(rows);

  let appearances: number | null = null;
  let tries: number | null = null;

  if (options?.isCurrent && options.currentClub) {
    const clubKey = normalizeForMatch(options.currentClub);
    const slRows = rows.filter((r) => normalizeForMatch(r.club).includes(clubKey.split(" ")[0] ?? clubKey));
    if (slRows.length > 0) {
      appearances = slRows.reduce((s, r) => s + r.appearances, 0);
      tries = slRows.reduce((s, r) => s + r.tries, 0);
    }
  }

  if (!options?.isCurrent || appearances === null) {
    const totalApps = rows.reduce((s, r) => s + r.appearances, 0);
    const totalTries = rows.reduce((s, r) => s + r.tries, 0);
    if (totalApps > 0) appearances = totalApps;
    if (totalTries > 0) tries = totalTries;
  }

  return {
    title: page.title,
    nationality,
    yearsActive,
    appearances: appearances && appearances > 0 ? appearances : null,
    tries: tries && tries > 0 ? tries : null,
    isRetired: retired,
  };
}
