/**
 * Bulk-download RLP player summary pages into scripts/rlp-cache/.
 * Validates each page before saving. Re-run safe — skips valid caches.
 * Run: npm run download:rlp && npm run enrich:rlp
 */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
  renameSync,
} from "fs";
import { join } from "path";
import { spawn } from "child_process";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;
const CONCURRENCY = 2;
const MAX_TIME_SEC = 60;
const RETRIES = 2;
const DELAY_MS = 500;

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

function isValidCache(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf-8").includes("Place Of Birth");
  } catch {
    return false;
  }
}

function purgeInvalidCaches(): number {
  let removed = 0;
  for (const file of readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".html")) continue;
    const path = join(CACHE_DIR, file);
    if (!isValidCache(path)) {
      unlinkSync(path);
      removed++;
    }
  }
  return removed;
}

function curlOnce(rlpId: string, tmp: string): Promise<boolean> {
  const url = `https://www.rugbyleagueproject.org/players/${rlpId}/summary.html`;
  return new Promise((resolve) => {
    const proc = spawn(
      "curl.exe",
      [
        "-sL",
        "-A",
        "Mozilla/5.0",
        url,
        "-o",
        tmp,
        "--max-time",
        String(MAX_TIME_SEC),
      ],
      { stdio: "ignore" }
    );
    proc.on("close", (code) => resolve(code === 0));
  });
}

async function downloadPage(rlpId: string): Promise<boolean> {
  const out = join(CACHE_DIR, `${rlpId}.html`);
  if (isValidCache(out)) return true;

  const tmp = `${out}.tmp`;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }

    const ok = await curlOnce(rlpId, tmp);
    if (!ok) {
      await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 2)));
      continue;
    }

    try {
      const html = readFileSync(tmp, "utf-8");
      if (!html.includes("Place Of Birth")) {
        unlinkSync(tmp);
        await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 2)));
        continue;
      }
      renameSync(tmp, out);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 2)));
    }
  }

  try {
    if (existsSync(tmp)) unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return false;
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
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const removed = purgeInvalidCaches();
  if (removed > 0) console.log(`Removed ${removed} invalid partial cache files`);

  const idMap = buildRlpIdMap(readFileSync(HTML_PATH, "utf-8"));
  const ids = new Set<string>();

  for (const file of FILES) {
    const players = JSON.parse(
      readFileSync(join(DATA_DIR, file), "utf-8")
    ) as { name: string; nationality: string }[];
    for (const p of players) {
      if (p.nationality !== "Unknown") continue;
      const id = idMap.get(normalizeName(p.name));
      if (id) ids.add(id);
    }
  }

  const list = [...ids].filter((id) => !isValidCache(join(CACHE_DIR, `${id}.html`)));
  console.log(`Downloading ${list.length} player pages (${CONCURRENCY} at a time)…`);

  let done = 0;
  let okCount = 0;
  const results = await mapPool(list, CONCURRENCY, async (id) => {
    const ok = await downloadPage(id);
    done++;
    if (ok) okCount++;
    if (done % 25 === 0 || done === list.length) {
      console.log(`  ${done}/${list.length} (${okCount} ok)`);
    }
    return ok;
  });

  const ok = results.filter(Boolean).length;
  console.log(`Downloaded ${ok}/${list.length} pages to ${CACHE_DIR}`);
  if (list.length - ok > 0) console.log(`  Failed: ${list.length - ok}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
