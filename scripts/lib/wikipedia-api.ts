/**
 * Shared Wikipedia MediaWiki API helpers with rate limiting and caching.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const WIKI_API = "https://en.wikipedia.org/w/api.php";
export const USER_AGENT =
  "27-0-wikipedia-enrichment/1.0 (fan project; contact: twentysevenzero@yahoo.com)";
export const DELAY_MS = 800;
export const RETRY_DELAY_MS = 5000;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function sanitizeCacheKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export function ensureCacheDir(cacheDir: string): void {
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
}

export function readCache<T>(cacheDir: string, key: string): T | null {
  const path = join(cacheDir, `${key}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeCache(cacheDir: string, key: string, data: unknown): void {
  ensureCacheDir(cacheDir);
  writeFileSync(join(cacheDir, `${key}.json`), `${JSON.stringify(data, null, 2)}\n`);
}

export async function wikiGet<T>(
  params: Record<string, string>,
  delayMs = DELAY_MS
): Promise<T | null> {
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
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const text = await res.text();
    if (text.startsWith("<!") || text.includes("too many requests")) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    await sleep(delayMs);
    return JSON.parse(text) as T;
  }
  return null;
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesLikelyMatch(title: string, playerName: string): boolean {
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

export async function searchWikipediaTitles(
  query: string,
  limit = 5
): Promise<string[]> {
  const data = await wikiGet<[string, string[]]>({
    action: "opensearch",
    search: query,
    limit: String(limit),
    namespace: "0",
  });
  return data?.[1] ?? [];
}

function extractRedirectTarget(wikitext: string): string | null {
  const match = wikitext.match(/^#REDIRECT\s*\[\[([^\]|#]+)/i);
  return match?.[1]?.trim() ?? null;
}

async function resolveWikiTitle(title: string): Promise<string> {
  type QueryResult = {
    query?: {
      pages?: Record<string, { title?: string; missing?: string }>;
    };
  };
  const data = await wikiGet<QueryResult>({
    action: "query",
    titles: title,
    redirects: "1",
  });
  if (!data?.query?.pages) return title;
  const page = Object.values(data.query.pages).find((p) => !p.missing);
  return page?.title ?? title;
}

export async function fetchWikitext(
  title: string,
  cacheDir?: string,
  redirectDepth = 0
): Promise<string | null> {
  if (redirectDepth > 3) return null;

  const cacheKey = sanitizeCacheKey(title);
  if (cacheDir) {
    const cached = readCache<{ wikitext: string; resolvedTitle?: string }>(
      cacheDir,
      cacheKey
    );
    if (cached?.wikitext) {
      const redirectTarget = extractRedirectTarget(cached.wikitext);
      if (redirectTarget) {
        return fetchWikitext(redirectTarget, cacheDir, redirectDepth + 1);
      }
      return cached.wikitext;
    }
  }

  const resolvedTitle = await resolveWikiTitle(title);

  type ParseResult = { parse?: { wikitext?: { "*": string } } };
  const data = await wikiGet<ParseResult>({
    action: "parse",
    page: resolvedTitle,
    prop: "wikitext",
    redirects: "1",
  });
  let wikitext = data?.parse?.wikitext?.["*"] ?? null;
  if (!wikitext) return null;

  const redirectTarget = extractRedirectTarget(wikitext);
  if (redirectTarget) {
    return fetchWikitext(redirectTarget, cacheDir, redirectDepth + 1);
  }

  if (cacheDir) {
    writeCache(cacheDir, cacheKey, {
      title,
      resolvedTitle,
      wikitext,
      fetchedAt: new Date().toISOString(),
    });
  }
  return wikitext;
}

export async function fetchPageExtract(
  title: string,
  cacheDir?: string
): Promise<{ title: string; description?: string; extract?: string } | null> {
  const cacheKey = `extract-${sanitizeCacheKey(title)}`;
  if (cacheDir) {
    const cached = readCache<{ title: string; description?: string; extract?: string }>(
      cacheDir,
      cacheKey
    );
    if (cached) return cached;
  }

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
  if (!page?.title) return null;

  const result = {
    title: page.title,
    description: page.description,
    extract: page.extract,
  };
  if (cacheDir) writeCache(cacheDir, cacheKey, { ...result, fetchedAt: new Date().toISOString() });
  return result;
}

export function mentionsRugbyLeague(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("rugby league") || lower.includes("rugby footballer");
}
