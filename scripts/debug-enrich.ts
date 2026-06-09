import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import current from "../data/current-squads.json";
import historic from "../data/historic-players.json";
import legends from "../data/legends.json";

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
const idToName = new Map<string, string>();
const nameToId = new Map<string, string>();
for (let i = 1; i < parts.length; i += 2) {
  const id = parts[i];
  const m = parts[i + 1]?.match(/^([^<]+)<\/a>/);
  if (!m) continue;
  const name = fmt(m[1]);
  idToName.set(id, name);
  nameToId.set(norm(name), id);
}

const all = [...current, ...historic, ...legends];
const unknownById = new Map(
  all
    .filter((p) => p.nationality === "Unknown")
    .map((p) => [nameToId.get(norm(p.name)), p.name] as const)
);

let enrichable = 0;
for (const f of readdirSync(join(__dirname, "rlp-cache"))) {
  const id = f.replace(".html", "");
  const page = readFileSync(join(__dirname, "rlp-cache", f), "utf8");
  if (!page.includes("Place Of Birth")) continue;
  if (unknownById.has(id)) {
    enrichable++;
    if (enrichable <= 5) console.log("Can enrich:", unknownById.get(id), id);
  }
}

console.log("Unknown total:", unknownById.size);
console.log("Enrichable with valid cache:", enrichable);
