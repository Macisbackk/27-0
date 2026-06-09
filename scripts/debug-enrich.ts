import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import current from "../data/current-squads.json";
import historic from "../data/historic-players.json";

function norm(n: string) {
  return n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fmt(rlpName: string): string {
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

const html = readFileSync(join(__dirname, "rlp-players.html"), "utf8");
const tbody = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);
const map = new Map<string, string>();
for (let i = 1; i < parts.length; i += 2) {
  const id = parts[i];
  const m = parts[i + 1]?.match(/^([^<]+)<\/a>/);
  if (m) map.set(norm(fmt(m[1])), id);
}

const unknown = [...current, ...historic].filter(
  (p) => p.nationality === "Unknown"
);
const cacheIds = new Set(
  readdirSync(join(__dirname, "rlp-cache")).map((f) => f.replace(".html", ""))
);

let overlap = 0;
let valid = 0;
for (const p of unknown) {
  const id = map.get(norm(p.name));
  if (!id || !cacheIds.has(id)) continue;
  overlap++;
  const html = readFileSync(join(__dirname, "rlp-cache", `${id}.html`), "utf8");
  if (html.includes("Place Of Birth")) valid++;
}

console.log("Unknown players:", unknown.length);
console.log("Cache files:", cacheIds.size);
console.log("Unknown with cache file:", overlap);
console.log("Valid cache (Place Of Birth):", valid);

for (const p of unknown.slice(0, 3)) {
  const id = map.get(norm(p.name));
  console.log(
    p.name,
    "->",
    id,
    existsSync(join(__dirname, "rlp-cache", `${id}.html`))
  );
}
