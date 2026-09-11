/**
 * Download RLP summary pages for players still on Unknown nationality,
 * then apply nationalityFromPlaceOfBirth where Place Of Birth exists.
 *
 * Run: npx tsx scripts/download-and-apply-unknown-nationalities.ts
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { spawn } from "child_process";
import {
  nameKey,
  parsePlaceOfBirth,
  nationalityFromPlaceOfBirth,
  parseBornField,
  isoDateFromDob,
  birthYearFromDob,
} from "./lib/rlp-parse";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const CACHE = join(__dirname, "rlp-cache");
const DELAY_MS = 400;
const MAX_DOWNLOADS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseTitle(html: string): string | null {
  const m =
    html.match(/<title>([^<]+?)\s*-\s*RLP<\/title>/i) ||
    html.match(/<title>([^<]+?)\s*-\s*Playing Career<\/title>/i) ||
    html.match(/<title>([^<]+?)\s*-\s*Rugby League Project<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function curl(url: string, outPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      "curl.exe",
      ["-sL", "-A", "Mozilla/5.0", url, "-o", outPath, "--max-time", "45"],
      { windowsHide: true }
    );
    proc.on("close", (code) => {
      if (code !== 0 || !existsSync(outPath)) {
        resolve(false);
        return;
      }
      const html = readFileSync(outPath, "utf8");
      resolve(
        html.includes("Playing Career") ||
          html.includes("Place Of Birth") ||
          html.includes("<dt>Born</dt>")
      );
    });
  });
}

function cacheHasName(key: string): boolean {
  for (const file of readdirSync(CACHE)) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE, file), "utf8");
    const title = parseTitle(html);
    if (title && nameKey(title) === key) return true;
  }
  return false;
}

async function main() {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

  const historic = JSON.parse(
    readFileSync(join(DATA, "historic-players.json"), "utf8")
  ) as Array<{
    id: string;
    name: string;
    nationality?: string;
    availableInGame?: boolean;
    dateOfBirth?: string;
    birthYear?: number;
  }>;

  const unknowns = historic.filter(
    (p) =>
      p.availableInGame !== false &&
      (!p.nationality || /^unknown$/i.test(p.nationality))
  );

  console.log(`Unknown nationality historic: ${unknowns.length}`);

  // Index existing cache by name
  const byName = new Map<string, string>();
  for (const file of readdirSync(CACHE)) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(join(CACHE, file), "utf8");
    const title = parseTitle(html);
    if (title) byName.set(nameKey(title), join(CACHE, file));
  }

  let downloaded = 0;
  let failed = 0;
  for (const p of unknowns) {
    if (downloaded >= MAX_DOWNLOADS) break;
    const key = nameKey(p.name);
    if (byName.has(key)) continue;
    const slug = slugifyName(p.name);
    const url = `https://www.rugbyleagueproject.org/players/${slug}/summary.html`;
    const out = join(CACHE, `${slug}.html`);
    const ok = await curl(url, out);
    if (ok) {
      byName.set(key, out);
      downloaded++;
      if (downloaded % 25 === 0) console.log(`Downloaded ${downloaded}…`);
    } else {
      failed++;
      try {
        if (existsSync(out)) writeFileSync(out, ""); // leave empty? better delete
      } catch {
        /* ignore */
      }
    }
    await sleep(DELAY_MS);
  }
  console.log(`Downloaded ${downloaded}, failed ${failed}`);

  // Rebuild index
  byName.clear();
  for (const file of readdirSync(CACHE)) {
    if (!file.endsWith(".html")) continue;
    const path = join(CACHE, file);
    const html = readFileSync(path, "utf8");
    if (html.length < 200) continue;
    const title = parseTitle(html);
    if (title) byName.set(nameKey(title), path);
  }

  let natFilled = 0;
  let dobFilled = 0;
  const filled: string[] = [];
  const still: string[] = [];

  for (const p of historic) {
    if (p.availableInGame === false) continue;
    const unknown = !p.nationality || /^unknown$/i.test(p.nationality);
    const path = byName.get(nameKey(p.name));
    if (!path) {
      if (unknown) still.push(p.name);
      continue;
    }
    const html = readFileSync(path, "utf8");
    if (unknown) {
      const place = parsePlaceOfBirth(html);
      const nat = place ? nationalityFromPlaceOfBirth(place) : null;
      if (nat) {
        p.nationality = nat;
        natFilled++;
        filled.push(`${p.id}: ${nat} (${place})`);
      } else if (unknown) {
        still.push(p.name);
      }
    }
    if (!p.dateOfBirth && p.birthYear == null) {
      const born = parseBornField(html);
      if (born) {
        const iso = isoDateFromDob(born);
        const y = birthYearFromDob(born);
        if (iso) p.dateOfBirth = iso;
        if (y) p.birthYear = y;
        dobFilled++;
      }
    }
  }

  writeFileSync(
    join(DATA, "historic-players.json"),
    JSON.stringify(historic, null, 2) + "\n"
  );
  writeFileSync(
    join(DATA, "download-unknown-nationalities-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        downloaded,
        failed,
        nationalityFilled: natFilled,
        dobFilled,
        stillUnknownCount: new Set(still).size,
        filled: filled.slice(0, 100),
        stillUnknownSample: [...new Set(still)].slice(0, 50),
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    `Nationality filled: ${natFilled}; DOB filled: ${dobFilled}; still unknown: ${new Set(still).size}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
