/**
 * Bulk-download RLP player summary pages into scripts/rlp-cache/.
 * Run before enrich:rlp when network is slow.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;
const CONCURRENCY = 4;
const MAX_TIME_SEC = 45;
const RETRIES = 3;

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

function curlOnce(rlpId: string, out: string): Promise<boolean> {
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
        out,
        "--max-time",
        String(MAX_TIME_SEC),
        "--retry",
        "2",
        "--retry-delay",
        "2",
      ],
      { stdio: "ignore" }
    );
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      try {
        const html = readFileSync(out, "utf-8");
        resolve(html.includes("Place Of Birth"));
      } catch {
        resolve(false);
      }
    });
  });
}

async function curlDownload(rlpId: string): Promise<boolean> {
  const out = join(CACHE_DIR, `${rlpId}.html`);
  if (existsSync(out) && readFileSync(out, "utf-8").includes("Place Of Birth")) {
    return true;
  }

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (await curlOnce(rlpId, out)) return true;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
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
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
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

  const list = [...ids];
  console.log(`Downloading ${list.length} player pages (${CONCURRENCY} at a time)…`);

  let done = 0;
  const results = await mapPool(list, CONCURRENCY, async (id) => {
    const ok = await curlDownload(id);
    done++;
    if (done % 50 === 0 || done === list.length) {
      console.log(`  ${done}/${list.length}`);
    }
    return ok;
  });

  const ok = results.filter(Boolean).length;
  const failed = list.length - ok;
  console.log(`Downloaded ${ok}/${list.length} pages to ${CACHE_DIR}`);
  if (failed > 0) console.log(`  Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
