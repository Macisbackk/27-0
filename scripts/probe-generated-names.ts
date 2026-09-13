import {
  generateRandomPlayerName,
  FIRST_NAMES,
  LAST_NAMES,
  FAMOUS_RL_SURNAME_BLOCKLIST,
  PACIFIC_LAST_NAMES,
  ANTIPODEAN_LAST_NAMES,
  BRITISH_LAST_NAMES,
  clearOccupiedPlayerNames,
} from "../src/lib/manager/names";
import currentSquads from "../data/current-squads.json";

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function surnameKey(last: string): string {
  return last
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/\s+/g, " ");
}

const reserved = new Set(
  (currentSquads as Array<{ name?: string }>)
    .map((p) => (p.name ? norm(p.name) : ""))
    .filter(Boolean)
);

clearOccupiedPlayerNames();

const N = 3000;
let collisions = 0;
let blockedSurnameHits = 0;
const seen = new Set<string>();
let internalDupes = 0;
const nat: Record<string, number> = {};

for (let i = 0; i < N; i++) {
  const club =
    i % 5 === 0
      ? "st-helens"
      : i % 5 === 1
        ? "catalans-dragons"
        : i % 5 === 2
          ? "wigan-warriors"
          : i % 5 === 3
            ? null
            : "wales";
  const g = generateRandomPlayerName(club);
  const key = norm(g.fullName);
  if (reserved.has(key)) collisions++;
  if (FAMOUS_RL_SURNAME_BLOCKLIST.has(surnameKey(g.lastName))) blockedSurnameHits++;
  if (seen.has(key)) internalDupes++;
  else seen.add(key);
  nat[g.nationality] = (nat[g.nationality] || 0) + 1;
}

const uk: Record<string, number> = {};
clearOccupiedPlayerNames();
for (let i = 0; i < 2000; i++) {
  const g = generateRandomPlayerName("leeds-rhinos");
  uk[g.nationality] = (uk[g.nationality] || 0) + 1;
}

const pacificNations = ["Samoa", "Tonga", "Fiji", "Cook Islands", "Papua New Guinea"];
const pacificShare =
  pacificNations.reduce((s, n) => s + (uk[n] || 0), 0) / 2000;
const nzShare = (uk["New Zealand"] || 0) / 2000;
const ausShare = (uk["Australia"] || 0) / 2000;

clearOccupiedPlayerNames();
const samples = Array.from({ length: 20 }, () => {
  const g = generateRandomPlayerName("warrington-wolves");
  return `${g.fullName} (${g.nationality})`;
});

const squadSurnames = new Set(
  [...reserved].map((n) => surnameKey(n.split(" ").slice(-1)[0] || ""))
);
const lastInSquad = LAST_NAMES.filter((l) => squadSurnames.has(surnameKey(l))).length;

console.log(
  JSON.stringify(
    {
      firstPool: FIRST_NAMES.length,
      lastPool: LAST_NAMES.length,
      pacificLast: PACIFIC_LAST_NAMES.length,
      antipodeanLast: ANTIPODEAN_LAST_NAMES.length,
      britishLast: BRITISH_LAST_NAMES.length,
      reservedSquadNames: reserved.size,
      collisions,
      blockedSurnameHits,
      uniqueOf: N,
      unique: seen.size,
      internalDupes,
      lastNamesAlsoInSquadSurnames: lastInSquad,
      sampleNatAll: nat,
      ukClubNat: uk,
      pacificNationShareUK: Number(pacificShare.toFixed(3)),
      nzShareUK: Number(nzShare.toFixed(3)),
      australiaShareUK: Number(ausShare.toFixed(3)),
      samples,
    },
    null,
    2
  )
);
