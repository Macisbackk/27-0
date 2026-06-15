/**
 * Enrich imported players with nationality and years active from RLP player pages.
 * Source IDs: scripts/rlp-players.html
 * Cache: scripts/rlp-cache/{id}.html
 * Run: npx tsx scripts/enrich-rlp-players.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;
const CONCURRENCY = 12;

const KNOWN_NATIONALITIES = new Set([
  "Albania",
  "Australia",
  "Cook Islands",
  "Democratic Republic of the Congo",
  "England",
  "Fiji",
  "France",
  "Ireland",
  "Italy",
  "Jamaica",
  "Lebanon",
  "Morocco",
  "New Zealand",
  "Nigeria",
  "Papua New Guinea",
  "Samoa",
  "Scotland",
  "Serbia",
  "Tonga",
  "Wales",
  "Zimbabwe",
]);

type RawPlayer = {
  id: string;
  name: string;
  nationality: string;
  yearsActive: string;
  category: string;
  intlCaps?: number;
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatName(rlpName: string): string {
  const m = rlpName.match(/^(.+?),\s*(.+)$/);
  if (!m) return rlpName;
  const surname = m[1]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  const first = m[2]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  return `${first} ${surname}`;
}

function buildRlpIdMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  const tbody = html.slice(tbodyStart, tbodyEnd);
  const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);

  for (let i = 1; i < parts.length; i += 2) {
    const rlpId = parts[i];
    const chunk = parts[i + 1];
    const nameMatch = chunk?.match(/^([^<]+)<\/a>/);
    if (!nameMatch) continue;
    map.set(normalizeName(formatName(nameMatch[1])), rlpId);
  }
  return map;
}

function nationalityFromPlaceOfBirth(place: string): string | null {
  const lower = place.toLowerCase();
  if (lower.includes("scotland")) return "Scotland";
  if (lower.includes("wales")) return "Wales";
  if (lower.includes("northern ireland")) return "Ireland";
  if (lower.includes("england")) return "England";
  if (lower.includes("ireland")) return "Ireland";
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("new zealand")) return "New Zealand";
  if (lower.includes("france")) return "France";
  if (lower.includes("samoa")) return "Samoa";
  if (lower.includes("tonga")) return "Tonga";
  if (lower.includes("fiji")) return "Fiji";
  if (lower.includes("papua")) return "Papua New Guinea";
  if (lower.includes("cook islands")) return "Cook Islands";
  if (lower.includes("lebanon")) return "Lebanon";
  if (lower.includes("jamaica")) return "Jamaica";
  if (lower.includes("italy")) return "Italy";
  if (lower.includes("serbia")) return "Serbia";
  if (lower.includes("nigeria")) return "Nigeria";
  if (lower.includes("morocco")) return "Morocco";
  if (lower.includes("albania")) return "Albania";
  if (lower.includes("zimbabwe")) return "Zimbabwe";
  if (lower.includes("democratic republic of the congo")) {
    return "Democratic Republic of the Congo";
  }

  const last = place.split(",").pop()?.trim();
  if (last && KNOWN_NATIONALITIES.has(last)) return last;
  return null;
}

function parsePlaceOfBirth(html: string): string | null {
  const m = html.match(
    /<dt>Place Of Birth<\/dt>\s*<dd>([^<]+)<\/dd>/i
  );
  return m?.[1]?.trim() ?? null;
}

function parseCareerYears(html: string, category: string): string | null {
  const marker = "English Career - By Year";
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const section = html.slice(start, start + 120_000);
  const rowChunks = section.split("<tr>");
  const activeYears: number[] = [];

  for (const chunk of rowChunks) {
    const seasonMatch = chunk.match(
      /<td class="text"><a href="[^"]+">[\s\S]*?<\/a><\/td>\s*<td class="text">(\d{4})<\/td>/
    );
    if (!seasonMatch) continue;

    const afterSeason = chunk.split(`<td class="text">${seasonMatch[1]}</td>`)[1];
    const appMatch = afterSeason?.match(/<td class="n">(\d+)<\/td>/);
    const apps = appMatch ? parseInt(appMatch[1], 10) : 0;
    if (!apps || apps <= 0) continue;

    activeYears.push(parseInt(seasonMatch[1], 10));
  }

  if (activeYears.length === 0) return null;

  const min = Math.min(...activeYears);
  const max = Math.max(...activeYears);
  const isCurrent = category === "current" || max >= 2024;
  const end = isCurrent ? "Present" : String(max);
  return `${min}–${end}`;
}

function parseIntlCaps(html: string): number | null {
  const m = html.match(
    /Tests \(Senior International Matches\)[\s\S]*?<td class="n">(\d+)<\/td>/
  );
  if (!m) return null;
  const caps = parseInt(m[1], 10);
  return Number.isFinite(caps) ? caps : null;
}

function readCachedPage(rlpId: string): string | null {
  const cachePath = join(CACHE_DIR, `${rlpId}.html`);
  if (!existsSync(cachePath)) return null;
  const html = readFileSync(cachePath, "utf-8");
  return html.includes("Place Of Birth") ? html : null;
}

interface EnrichResult {
  nationality?: string;
  yearsActive?: string;
  intlCaps?: number;
}

async function enrichFromRlp(
  rlpId: string,
  category: string
): Promise<EnrichResult | null> {
  const html = readCachedPage(rlpId);
  if (!html) return null;

  const result: EnrichResult = {};
  const place = parsePlaceOfBirth(html);
  if (place) {
    const nat = nationalityFromPlaceOfBirth(place);
    if (nat) result.nationality = nat;
  }

  const years = parseCareerYears(html, category);
  if (years) result.yearsActive = years;

  const caps = parseIntlCaps(html);
  if (caps !== null && caps > 0) result.intlCaps = caps;

  return result;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const listHtml = readFileSync(HTML_PATH, "utf-8");
  const idMap = buildRlpIdMap(listHtml);

  let nationalityUpdated = 0;
  let yearsUpdated = 0;
  let missingRlp = 0;
  let fetchFailed = 0;

  for (const file of FILES) {
    const path = join(DATA_DIR, file);
    const players = JSON.parse(readFileSync(path, "utf-8")) as RawPlayer[];
    const targets = players.filter((p) => p.nationality === "Unknown");

    console.log(`\n${file}: enriching ${targets.length} players…`);

    const jobs = targets.map((player) => ({
      player,
      rlpId: idMap.get(normalizeName(player.name)) ?? null,
    }));

    missingRlp += jobs.filter((j) => !j.rlpId).length;

    const withIds = jobs.filter((j): j is typeof j & { rlpId: string } => !!j.rlpId);

    const enriched = await mapPool(withIds, CONCURRENCY, async (job) => {
      const data = await enrichFromRlp(job.rlpId, job.player.category);
      return { player: job.player, data };
    });

    let fileChanged = false;
    for (const { player, data } of enriched) {
      if (!data) {
        fetchFailed++;
        continue;
      }

      if (data.nationality && player.nationality === "Unknown") {
        player.nationality = data.nationality;
        nationalityUpdated++;
        fileChanged = true;
      }

      if (data.yearsActive && data.yearsActive !== player.yearsActive) {
        player.yearsActive = data.yearsActive;
        yearsUpdated++;
        fileChanged = true;
      }
    }

    writeFileSync(path, JSON.stringify(players, null, 2) + "\n");
    console.log(
      `  Saved ${file} (${fileChanged ? "updated" : "unchanged"})`
    );
  }

  console.log("\nEnrichment complete:");
  console.log(`  Nationality updated: ${nationalityUpdated}`);
  console.log(`  Years active updated: ${yearsUpdated}`);
  console.log(`  No RLP ID match: ${missingRlp}`);
  console.log(`  Fetch failures: ${fetchFailed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
