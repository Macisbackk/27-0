/**
 * Build verified career tries for current players from RLP + legend cross-reference.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const current = JSON.parse(
  readFileSync(join(root, "data/current-squads.json"), "utf8")
);
const legends = JSON.parse(
  readFileSync(join(root, "data/legends.json"), "utf8")
);

const legendTriesByName = new Map(
  legends
    .filter((l) => typeof l.tries === "number")
    .map((l) => [l.name.toLowerCase(), l.tries])
);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+/g, "-");
}

function parseFirstClassTries(html) {
  const row = html.match(/First Class[\s\S]*?<\/tr>/i)?.[0];
  if (!row) return null;

  const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim()
  );

  // Starts, Int, APP, ST, PT, T
  const tries = tds[7];
  if (!tries || tries === "-") return null;
  const value = Number(tries);
  return Number.isNaN(value) ? null : value;
}

function isPlausible(player, tries) {
  if (tries === null || tries < 0) return false;
  const start = parseInt((player.yearsActive || "").split(/[–-]/)[0], 10);
  const years = Number.isNaN(start) ? 0 : 2026 - start;
  const pos = player.position;

  if (years >= 8 && ["WING", "FULLBACK", "CENTRE"].includes(pos) && tries < 15) {
    return false;
  }
  if (years >= 10 && tries < 5) return false;
  return true;
}

async function fetchTries(name) {
  const slug = slugify(name);
  const url = `https://www.rugbyleagueproject.org/players/${slug}/summary.html`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "27-0-audit/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseFirstClassTries(html);
  } catch {
    return null;
  }
}

const veterans = current.filter((p) => {
  const start = parseInt((p.yearsActive || "").split(/[–-]/)[0], 10);
  return !Number.isNaN(start) && start <= 2018;
});

const verified = {};
let fromLegend = 0;
let fromRlp = 0;
let skipped = 0;

for (const player of veterans) {
  const legendTries = legendTriesByName.get(player.name.toLowerCase());
  if (legendTries !== undefined) {
    verified[player.id] = legendTries;
    fromLegend++;
    console.log(`legend ${player.name}: ${legendTries}`);
    continue;
  }

  const tries = await fetchTries(player.name);
  if (isPlausible(player, tries)) {
    verified[player.id] = tries;
    fromRlp++;
    console.log(`rlp ${player.name}: ${tries}`);
  } else {
    skipped++;
    console.log(`skip ${player.name}: ${tries ?? "n/a"}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}

writeFileSync(
  join(root, "data/career-tries-corrections.json"),
  JSON.stringify(verified, null, 2) + "\n"
);

console.log(
  `Done: ${fromLegend} legend, ${fromRlp} RLP, ${skipped} skipped, ${Object.keys(verified).length} total`
);
