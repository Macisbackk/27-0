const data = require("../data/current-squads.json") as Array<{
  name: string;
  position?: string;
  positions?: string[];
  positionAbbrev?: string;
}>;

const dualStats: Record<string, number> = {};
let withPositions = 0;
let onlyOne = 0;
let soShOnly = 0;
let realDual = 0;
const samples: Array<{ name: string; primary?: string; positions: string[]; abbrev?: string }> = [];
const halfs = new Set(["STAND_OFF", "SCRUM_HALF", "HALFBACK", "SO", "SH", "HB", "FIVE_EIGHTH", "HALF"]);

function norm(x: string): string {
  return String(x).toUpperCase().replace(/\s+/g, "_");
}

for (const p of data) {
  const primary = p.position;
  const positions = Array.isArray(p.positions) ? p.positions : [];
  if (positions.length) withPositions++;
  const uniq = [...new Set((positions.length ? positions : primary ? [primary] : []).map(norm))];
  if (uniq.length <= 1) {
    onlyOne++;
    continue;
  }
  const key = [...uniq].sort().join("+");
  dualStats[key] = (dualStats[key] || 0) + 1;
  const nonHalf = uniq.filter((x) => !halfs.has(x));
  const halfCount = uniq.length - nonHalf.length;
  if (uniq.length === 2 && halfCount === 2) soShOnly++;
  else realDual++;
  if (samples.length < 30) {
    samples.push({ name: p.name, primary, positions: uniq, abbrev: p.positionAbbrev });
  }
}

console.log(
  JSON.stringify(
    { total: data.length, withPositions, onlyOne, soShOnly, realDual, dualStats, samples },
    null,
    2
  )
);
