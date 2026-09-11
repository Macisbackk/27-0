/**
 * Apply verified DOBs for 2026 depth players researched during the audit.
 * Run: npx tsx scripts/apply-verified-2026-dobs.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PATH = join(__dirname, "..", "data", "current-squads.json");

/** id → ISO DOB (verified Wikipedia / RLP / NRL.com) */
const DOBS: Record<string, string> = {
  "castleford-cur-mikaele-ravalawa": "1997-11-09",
  "leigh-cur-jacob-alick-wiencke": "1999-11-03",
  "hull-kr-cur-jack-broadbent": "2000-11-01",
  "hull-fc-cur-logan-moy": "2005-08-10",
  "castleford-cur-tyler-dupree": "2000-02-08",
  "leigh-cur-innes-senior": "2000-05-30",
  "castleford-cur-louis-senior": "2000-05-30",
  "leeds-cur-ryan-hall": "1987-11-27",
  "leigh-cur-josh-charnley": "1991-06-26",
  "bradford-cur-alfie-leake": "2006-09-14",
};

type Raw = { id: string; dateOfBirth?: string; birthYear?: number };

const players = JSON.parse(readFileSync(PATH, "utf8")) as Raw[];
let n = 0;
for (const p of players) {
  const dob = DOBS[p.id];
  if (!dob) continue;
  p.dateOfBirth = dob;
  p.birthYear = Number(dob.slice(0, 4));
  n++;
}
writeFileSync(PATH, JSON.stringify(players, null, 2) + "\n");
console.log(`Applied ${n} verified DOBs`);
