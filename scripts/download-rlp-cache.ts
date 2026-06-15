/**
 * Bulk-download RLP player summary pages into scripts/rlp-cache/.
 * Downloads pages for any enrichable player missing cache (not only Unknown nationality).
 * Run: npm run download:rlp
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
import { buildRlpIdMap, nameKey } from "./lib/rlp-parse";

const DATA_DIR = join(__dirname, "..", "data");
const HTML_PATH = join(__dirname, "rlp-players.html");
const CACHE_DIR = join(__dirname, "rlp-cache");
const FILES = ["current-squads.json", "historic-players.json", "legends.json"] as const;
const CONCURRENCY = 2;
const MAX_TIME_SEC = 60;
const RETRIES = 2;
const DELAY_MS = 500;

type RawPlayer = {
  id: string;
  name: string;
  nationality: string;
  yearsActive?: string;
  dateOfBirth?: string;
  birthYear?: number;
  appearances?: number;
  tries?: number;
  availableInGame?: boolean;
};

function isHiddenOrArchived(player: RawPlayer): boolean {
  if (player.availableInGame === false) return true;
  if (player.id === "jm-goat-joe-mellor") return true;
  if (player.id.startsWith("ssh-sam-hallas-")) return true;
  return false;
}

function needsCache(player: RawPlayer): boolean {
  return (
    !player.nationality ||
    player.nationality === "Unknown" ||
    !player.yearsActive ||
    player.yearsActive === "Unknown" ||
    player.yearsActive.endsWith("–Unknown") ||
    !player.dateOfBirth ||
    !player.birthYear ||
    player.appearances === undefined ||
    player.appearances === null ||
    player.tries === undefined ||
    player.tries === null
  );
}

function isValidCache(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const html = readFileSync(path, "utf-8");
    return html.includes("Place Of Birth") || html.includes("<dt>Born</dt>");
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
      if (
        !html.includes("Place Of Birth") &&
        !html.includes("<dt>Born</dt>")
      ) {
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
    ) as RawPlayer[];
    for (const p of players) {
      if (isHiddenOrArchived(p) || !needsCache(p)) continue;
      const id = idMap.get(nameKey(p.name));
      if (id) ids.add(id);
    }
  }

  const list = [...ids].filter((id) => !isValidCache(join(CACHE_DIR, `${id}.html`)));
  console.log(`Downloading ${list.length} player pages (${CONCURRENCY} at a time)…`);

  let done = 0;
  let okCount = 0;
  await mapPool(list, CONCURRENCY, async (id) => {
    const ok = await downloadPage(id);
    done++;
    if (ok) okCount++;
    if (done % 25 === 0 || done === list.length) {
      console.log(`  ${done}/${list.length} (${okCount} ok)`);
    }
    return ok;
  });

  console.log(`Downloaded ${okCount}/${list.length} pages to ${CACHE_DIR}`);
  if (list.length - okCount > 0) console.log(`  Failed: ${list.length - okCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
