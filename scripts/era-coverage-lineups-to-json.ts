/**
 * One-off: turn the researched match line-ups (scratch text, one block per club-season) into
 * data/era-coverage-lineups-2026-10.json. Each block: "@club|year|source url|match" then one
 * "POS Name" line per player in shirt order 1–17 (FB W C C W FE HB FR HK FR 2R 2R L, then B).
 * Run: bun scripts/era-coverage-lineups-to-json.ts <lineups.txt>
 */
import fs from "node:fs";
import path from "node:path";
const src = fs.readFileSync(process.argv[2]!, "utf8");
const out: Array<{ club: string; year: number; source: string; match: string; squad: { number: number; position: string; name: string }[] }> = [];
for (const block of src.split(/^@/m).slice(1)) {
  const [head, ...lines] = block.trim().split("\n");
  const [club, year, source, match] = head!.split("|");
  const squad = lines.filter((l) => l.trim() && !l.startsWith("#")).map((l, i) => {
    const m = l.trim().match(/^(FB|W|C|FE|HB|FR|HK|2R|L|B)\s+(.+)$/);
    if (!m) throw new Error(`bad line ${l} in ${head}`);
    return { number: i + 1, position: m[1]!, name: m[2]!.trim() };
  });
  out.push({ club: club!, year: Number(year), source: source!, match: match!, squad });
}
const file = path.resolve(import.meta.dirname ?? __dirname, "..", "data", "era-coverage-lineups-2026-10.json");
fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${out.length} line-ups → ${file}`);
for (const e of out) console.log(`  ${e.club} ${e.year}: ${e.squad.length}`);
