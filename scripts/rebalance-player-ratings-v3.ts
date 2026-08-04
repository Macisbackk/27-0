/**
 * Player rating rebalance v3 — evidence-led, floor 80 for Current & Historic.
 *
 * Forbidden as final mapping: clamp(old), old+N, linear rescale of old order.
 * Pipeline: research evidence → position weights → peer rank → band → overrides.
 *
 * Run: npx tsx scripts/rebalance-player-ratings-v3.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA = join(__dirname, "..", "data");
const CURRENT_MIN = 80;
const HISTORIC_MIN = 80;
const SCHEMA_VERSION = 3;

type Pos =
  | "FULLBACK"
  | "WING"
  | "CENTRE"
  | "STAND_OFF"
  | "SCRUM_HALF"
  | "HOOKER"
  | "PROP"
  | "SECOND_ROW"
  | "LOOSE_FORWARD"
  | string;

interface RawPlayer {
  id: string;
  name: string;
  position: string;
  club: string;
  nationality?: string;
  category: "current" | "historic" | "legend";
  peakRating: number;
  value?: number;
  appearances?: number;
  tries?: number;
  yearsActive?: string;
  clubLegend?: boolean;
  superLeagueWinner?: boolean;
  challengeCupWinner?: boolean;
  hallOfFame?: boolean;
  manOfSteel?: boolean;
  status?: string;
  [key: string]: unknown;
}

interface LedgerEntry {
  playerId: string;
  playerName: string;
  playerType: "current" | "historic";
  position: string;
  clubId: string;
  previousRating: number;
  newRating: number;
  ratingTier: string;
  evidenceSummary: string;
  peakOrCurrentBasis: "current-2026" | "historic-peak";
  sourceNames: string[];
  sourceUrls: string[];
  statsUsed: Record<string, number | string | null>;
  honoursUsed: string[];
  representativeEvidence: string[];
  confidence: "high" | "medium" | "low";
  manualOverride?: boolean;
  reviewNotes?: string;
  evidenceScore: number;
}

/** Explicit user / project overrides — applied last. */
const MANUAL_OVERRIDES: Record<string, number> = {
  "hull-kr-cur-arthur-mourgue": 87,
  "huddersfield-cur-george-flanagan-jr": 83,
  "bradford-cur-joe-mellor": 83,
  "wigan-hist-matt-bowen": 87,
  // Legends retain hierarchy
  "ellery-hanley": 97,
  "garry-schofield": 97,
  "andrew-johns": 96,
  "jason-robinson": 96,
  "paul-sculthorpe": 96,
  "andy-farrell": 95,
  "bradford-leg-robbie-hunter-paul": 95,
  "kevin-sinfield": 95,
  "sam-burgess": 95,
  "martin-offiah": 94,
  "wigan-hist-sam-tomkins": 94,
  "jamie-peacock": 93,
  "paul-newlove": 92,
  "rob-burrow": 92,
  "sean-long": 91,
  "danny-mcguire": 91,
  "adrian-morley": 90,
  "stuart-fielden": 90,
  "jamie-jones-buchanan": 90,
};

/**
 * 2025 official award calibration (Super League / BBC / Sky).
 * Boosts evidence score — not a direct rating assignment.
 */
const RESEARCH_AWARD_BOOST: Record<
  string,
  { boost: number; notes: string; urls: string[] }
> = {
  "leeds-cur-jake-connor": {
    boost: 28,
    notes: "2025 Steve Prescott MBE Man of Steel; 2025 Dream Team SH",
    urls: [
      "https://www.superleague.co.uk/article/5544/jake-connor-named-steve-prescott-mbe-man-of-steel",
      "https://www.superleague.co.uk/dream-team",
    ],
  },
  "hull-kr-cur-mikey-lewis": {
    boost: 24,
    notes: "2024 Man of Steel; 2025 Dream Team SO; 2025 MOS shortlist",
    urls: [
      "https://www.superleague.co.uk/dream-team",
      "https://www.bbc.co.uk/sport/rugby-league/articles/c5yqn3e1vxko",
    ],
  },
  "wigan-cur-jai-field": {
    boost: 20,
    notes: "2025 Dream Team FB; 2025 MOS shortlist",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "wigan-cur-liam-marshall": {
    boost: 16,
    notes: "2025 Dream Team wing (2nd selection)",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "hull-fc-cur-lewis-martin": {
    boost: 16,
    notes: "2025 Dream Team wing",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "hull-kr-cur-peta-hiku": {
    boost: 16,
    notes: "2025 Dream Team centre",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "leigh-cur-umyla-hanley": {
    boost: 16,
    notes: "2025 Dream Team centre",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "wakefield-cur-mike-mcmeeken": {
    boost: 16,
    notes: "2025 Dream Team prop (2nd selection)",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "hull-fc-cur-herman-eseese": {
    boost: 16,
    notes: "2025 Dream Team prop",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "hull-kr-cur-jez-litten": {
    boost: 16,
    notes: "2025 Dream Team hooker",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "hull-kr-cur-dean-hadley": {
    boost: 16,
    notes: "2025 Dream Team second row",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "leeds-cur-james-mcdonnell": {
    boost: 16,
    notes: "2025 Dream Team second row",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "st-helens-cur-morgan-knowles": {
    boost: 18,
    notes: "2025 Dream Team LF (5th selection)",
    urls: ["https://www.superleague.co.uk/dream-team"],
  },
  "wigan-cur-bevan-french": {
    boost: 22,
    notes: "Elite attacking FB/utility; sustained top-tier impact 2024–26",
    urls: ["https://www.superleague.co.uk/"],
  },
};

/** Position-specific try-rate expectation (career tries per game for a “good” starter). */
const POS_TRY_BASELINE: Record<string, number> = {
  FULLBACK: 0.35,
  WING: 0.45,
  CENTRE: 0.28,
  STAND_OFF: 0.22,
  SCRUM_HALF: 0.18,
  HOOKER: 0.12,
  PROP: 0.05,
  SECOND_ROW: 0.12,
  LOOSE_FORWARD: 0.1,
};

/** How much try-rate should influence vs workload/honours. */
const POS_TRY_WEIGHT: Record<string, number> = {
  FULLBACK: 0.22,
  WING: 0.28,
  CENTRE: 0.24,
  STAND_OFF: 0.14,
  SCRUM_HALF: 0.12,
  HOOKER: 0.08,
  PROP: 0.04,
  SECOND_ROW: 0.12,
  LOOSE_FORWARD: 0.1,
};

const INT_TIER: Record<string, number> = {
  Australia: 10,
  "New Zealand": 9,
  England: 8,
  Samoa: 7,
  Tonga: 7,
  Fiji: 6,
  France: 6,
  "Papua New Guinea": 5,
  Wales: 4,
  Ireland: 3,
  Scotland: 3,
  Jamaica: 2,
};

function normPos(p: string): string {
  const u = p.toUpperCase().replace(/\s+/g, "_");
  if (u.includes("FULL")) return "FULLBACK";
  if (u.includes("WING")) return "WING";
  if (u.includes("CENTRE") || u.includes("CENTER")) return "CENTRE";
  if (u.includes("STAND") || u === "SO" || u.includes("FIVE")) return "STAND_OFF";
  if (u.includes("SCRUM") || u === "SH" || u.includes("HALF")) return "SCRUM_HALF";
  if (u.includes("HOOK")) return "HOOKER";
  if (u.includes("PROP")) return "PROP";
  if (u.includes("SECOND")) return "SECOND_ROW";
  if (u.includes("LOOSE") || u.includes("LOCK")) return "LOOSE_FORWARD";
  return u;
}

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function ratingTierLabel(r: number, type: "current" | "historic"): string {
  if (type === "current") {
    if (r >= 96) return "generational-current";
    if (r >= 94) return "exceptional-current";
    if (r >= 92) return "elite-sl";
    if (r >= 90) return "top-tier-sl";
    if (r >= 88) return "very-good-sl";
    if (r >= 86) return "good-sl";
    if (r >= 84) return "reliable-squad";
    if (r >= 82) return "fringe-squad";
    return "development";
  }
  if (r >= 97) return "transcendent-legend";
  if (r >= 95) return "all-time-great";
  if (r >= 92) return "elite-historic";
  if (r >= 89) return "excellent-historic";
  if (r >= 86) return "strong-historic";
  if (r >= 83) return "solid-historic";
  return "recognisable-depth";
}

function computeEvidence(
  p: RawPlayer,
  mos: Record<string, number[]>,
  lance: string[],
  dream: Record<string, number[]>,
  golden: Record<string, number[]>
): {
  score: number;
  summary: string;
  honours: string[];
  representative: string[];
  stats: Record<string, number | string | null>;
  confidence: "high" | "medium" | "low";
  sources: string[];
  urls: string[];
} {
  const pos = normPos(p.position);
  const apps = typeof p.appearances === "number" ? p.appearances : null;
  const tries = typeof p.tries === "number" ? p.tries : null;
  const tpg = apps && apps > 0 && tries != null ? tries / apps : null;
  const baseline = POS_TRY_BASELINE[pos] ?? 0.15;
  const tryW = POS_TRY_WEIGHT[pos] ?? 0.15;

  let score = 0;
  const honours: string[] = [];
  const representative: string[] = [];
  const sources: string[] = ["In-game player database"];
  const urls: string[] = [];

  // Appearances — volume / longevity (capped so longevity alone cannot dominate)
  if (apps != null) {
    const appScore = clamp(Math.log10(apps + 1) / Math.log10(400), 0, 1) * 18;
    score += appScore;
  } else {
    score += 6; // unknown — modest baseline
  }

  // Position-normalised try contribution
  if (tpg != null) {
    const ratio = tpg / Math.max(0.03, baseline);
    score += clamp(ratio, 0, 2.2) * tryW * 40;
  }

  // International nationality tier (proxy for representative level)
  const nat = p.nationality ?? "";
  const intl = INT_TIER[nat] ?? 0;
  if (intl > 0) {
    score += intl;
    representative.push(`${nat} international pathway`);
  }

  // Honours flags / award maps
  const mosY = mos[p.id] ?? [];
  if (mosY.length || p.manOfSteel) {
    score += 18 + mosY.length * 6;
    honours.push(
      mosY.length
        ? `Man of Steel (${mosY.join(", ")})`
        : "Man of Steel (flagged)"
    );
    sources.push("Man of Steel winners archive");
  }
  if (lance.includes(p.id)) {
    score += 12;
    honours.push("Lance Todd Trophy");
    sources.push("Lance Todd Trophy archive");
  }
  const dt = dream[p.id] ?? [];
  if (dt.length) {
    score += 8 + Math.min(12, dt.length * 3);
    honours.push(`Dream Team ×${dt.length}`);
    sources.push("Super League Dream Team archive");
  }
  const gb = golden[p.id] ?? [];
  if (gb.length) {
    score += 10 + gb.length * 4;
    honours.push(`Golden Boot (${gb.join(", ")})`);
    sources.push("Golden Boot archive");
  }
  if (p.hallOfFame) {
    score += 16;
    honours.push("Hall of Fame");
  }
  if (p.clubLegend) {
    score += 6;
    honours.push("Club Legend");
  }
  if (p.superLeagueWinner) {
    score += 5;
    honours.push("Super League winner");
  }
  if (p.challengeCupWinner) {
    score += 4;
    honours.push("Challenge Cup winner");
  }

  // 2025 research boosts
  const research = RESEARCH_AWARD_BOOST[p.id];
  if (research) {
    score += research.boost;
    honours.push(research.notes);
    sources.push("Official Super League awards 2025");
    urls.push(...research.urls);
  }

  // Weak prior from previous rating (≤12% of a typical score) — peer ordering only
  score += ((p.peakRating - 75) / 24) * 8;

  let confidence: "high" | "medium" | "low" = "medium";
  if (research || mosY.length || dt.length >= 2 || p.hallOfFame) confidence = "high";
  if (apps == null && tries == null && !honours.length) confidence = "low";

  const summary = [
    `${pos}`,
    apps != null ? `${apps} apps` : "apps unknown",
    tpg != null ? `${tpg.toFixed(2)} tpg` : "tries unknown",
    honours.length ? honours.slice(0, 3).join("; ") : "limited honours data",
  ].join(" · ");

  return {
    score,
    summary,
    honours,
    representative,
    stats: {
      appearances: apps,
      tries,
      triesPerGame: tpg != null ? Number(tpg.toFixed(3)) : null,
      nationality: nat || null,
      previousRating: p.peakRating,
    },
    confidence,
    sources: [...new Set(sources)],
    urls,
  };
}

/**
 * Map peer rank percentile → rating using target band masses (not a rescale of old).
 */
function percentileToRating(
  percentile: number,
  type: "current" | "historic"
): number {
  // percentile 0 = weakest, 1 = strongest
  const p = clamp(percentile, 0, 1);
  if (type === "current") {
    // Targets: 80-82 ~15%, 83-85 ~30%, 86-88 ~30%, 89-91 ~15%, 92-94 ~8%, 95-96 ~2%
    if (p < 0.15) return 80 + Math.floor((p / 0.15) * 3); // 80-82
    if (p < 0.45) return 83 + Math.floor(((p - 0.15) / 0.3) * 3); // 83-85
    if (p < 0.75) return 86 + Math.floor(((p - 0.45) / 0.3) * 3); // 86-88
    if (p < 0.9) return 89 + Math.floor(((p - 0.75) / 0.15) * 3); // 89-91
    if (p < 0.98) return 92 + Math.floor(((p - 0.9) / 0.08) * 3); // 92-94
    return p > 0.995 ? 96 : 95;
  }
  // Historic: slightly more room at the top for all-time greats
  if (p < 0.18) return 80 + Math.floor((p / 0.18) * 3);
  if (p < 0.48) return 83 + Math.floor(((p - 0.18) / 0.3) * 3);
  if (p < 0.75) return 86 + Math.floor(((p - 0.48) / 0.27) * 3);
  if (p < 0.9) return 89 + Math.floor(((p - 0.75) / 0.15) * 3);
  if (p < 0.97) return 92 + Math.floor(((p - 0.9) / 0.07) * 3);
  if (p < 0.995) return 95 + Math.floor(((p - 0.97) / 0.025) * 2); // 95-96
  return 97;
}

function ratingToValue(rating: number): number {
  if (rating >= 95) return Math.round((500_000 + (rating - 95) * 60_000) / 1000) * 1000;
  if (rating >= 90) return Math.round((250_000 + (rating - 90) * 50_000) / 1000) * 1000;
  if (rating >= 85) return Math.round((150_000 + (rating - 85) * 20_000) / 1000) * 1000;
  if (rating >= 80) return Math.round((90_000 + (rating - 80) * 15_000) / 1000) * 1000;
  return 75_000;
}

function rebalanceGroup(
  players: RawPlayer[],
  type: "current" | "historic",
  mos: Record<string, number[]>,
  lance: string[],
  dream: Record<string, number[]>,
  golden: Record<string, number[]>
): { players: RawPlayer[]; ledger: LedgerEntry[] } {
  const scored = players.map((p) => {
    const ev = computeEvidence(p, mos, lance, dream, golden);
    return { p, ev };
  });

  // Rank within position first, then blend with overall rank for cross-club fairness
  const byPos = new Map<string, typeof scored>();
  for (const row of scored) {
    const pos = normPos(row.p.position);
    const list = byPos.get(pos) ?? [];
    list.push(row);
    byPos.set(pos, list);
  }
  for (const list of byPos.values()) {
    list.sort((a, b) => a.ev.score - b.ev.score);
  }

  scored.sort((a, b) => a.ev.score - b.ev.score);

  const ledger: LedgerEntry[] = [];
  const out: RawPlayer[] = [];

  for (let i = 0; i < scored.length; i++) {
    const { p, ev } = scored[i]!;
    const pos = normPos(p.position);
    const posList = byPos.get(pos)!;
    const posIdx = posList.findIndex((r) => r.p.id === p.id);
    const overallPct = scored.length <= 1 ? 0.5 : i / (scored.length - 1);
    const posPct = posList.length <= 1 ? 0.5 : posIdx / (posList.length - 1);
    // Blend: position peer comparison 55%, overall 45%
    const pct = posPct * 0.55 + overallPct * 0.45;

    let newRating = percentileToRating(pct, type);
    newRating = clamp(
      newRating,
      type === "current" ? CURRENT_MIN : HISTORIC_MIN,
      type === "current" ? 96 : 97
    );

    const override = MANUAL_OVERRIDES[p.id];
    const wasOverride = override != null;
    if (wasOverride) newRating = override;

    const previous = p.peakRating;
    p.peakRating = newRating;
    p.value = ratingToValue(newRating);

    ledger.push({
      playerId: p.id,
      playerName: p.name,
      playerType: type,
      position: pos,
      clubId: p.club,
      previousRating: previous,
      newRating,
      ratingTier: ratingTierLabel(newRating, type),
      evidenceSummary: ev.summary,
      peakOrCurrentBasis: type === "current" ? "current-2026" : "historic-peak",
      sourceNames: ev.sources,
      sourceUrls: ev.urls,
      statsUsed: ev.stats,
      honoursUsed: ev.honours,
      representativeEvidence: ev.representative,
      confidence: wasOverride ? "high" : ev.confidence,
      manualOverride: wasOverride || undefined,
      reviewNotes: wasOverride
        ? "Explicit project override"
        : ev.confidence === "low"
          ? "Limited statistical evidence — flagged for review"
          : undefined,
      evidenceScore: Number(ev.score.toFixed(2)),
    });
    out.push(p);
  }

  return { players: out, ledger };
}

function writeOverridesTs(overrides: Record<string, number>): void {
  const legends = Object.entries(overrides).filter(([id]) =>
    id.includes("-leg-") ||
    [
      "ellery-hanley",
      "garry-schofield",
      "andrew-johns",
      "jason-robinson",
      "paul-sculthorpe",
      "andy-farrell",
      "kevin-sinfield",
      "sam-burgess",
      "martin-offiah",
      "jamie-peacock",
      "paul-newlove",
      "rob-burrow",
      "sean-long",
      "danny-mcguire",
      "adrian-morley",
      "stuart-fielden",
      "jamie-jones-buchanan",
    ].includes(id)
  );
  const hist = Object.entries(overrides).filter(
    ([id]) => id.includes("-hist-") || id.includes("hist-")
  );
  const cur = Object.entries(overrides).filter(
    ([id]) => id.includes("-cur-") || id.includes("cur-")
  );
  const rest = Object.entries(overrides).filter(
    ([id]) =>
      !legends.some(([a]) => a === id) &&
      !hist.some(([a]) => a === id) &&
      !cur.some(([a]) => a === id)
  );

  const fmt = (entries: [string, number][]) =>
    entries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, r]) => `  "${id}": ${r},`)
      .join("\n");

  const body = `/**
 * Manual player rating overrides — single source of truth.
 * Synced from data/player-rating-overrides.json by rebalance-player-ratings-v3.
 * These ratings always take precedence over values in JSON player files.
 */
export const PLAYER_RATING_OVERRIDES: Record<string, number> = {
  // ── Legends & GOAT-tier ────────────────────────────────────────────────
${fmt(legends)}

  // ── Historic ───────────────────────────────────────────────────────────
${fmt([...hist, ...rest.filter(([id]) => !id.includes("-cur-"))])}

  // ── Current Super League ───────────────────────────────────────────────
${fmt(cur)}
};

export const PLAYER_RATING_OVERRIDE_IDS = Object.keys(
  PLAYER_RATING_OVERRIDES
) as (keyof typeof PLAYER_RATING_OVERRIDES)[];
`;
  writeFileSync(join(DATA, "player-rating-overrides.ts"), body, "utf8");
}

// ── Main ──────────────────────────────────────────────────────────────────
const current = loadJson<RawPlayer[]>("current-squads.json");
const historic = loadJson<RawPlayer[]>("historic-players.json");
const legends = loadJson<RawPlayer[]>("legends.json");
const mos = loadJson<Record<string, number[]>>("man-of-steel-winners.json");
const lance = loadJson<string[]>("lance-todd-winners.json");
const dream = loadJson<Record<string, number[]>>("dream-team-years.json");
const golden = loadJson<Record<string, number[]>>("golden-boot-years.json");

const curResult = rebalanceGroup(current, "current", mos, lance, dream, golden);
const histResult = rebalanceGroup(historic, "historic", mos, lance, dream, golden);

// Sync legend JSON to overrides (hierarchy preserved)
for (const leg of legends) {
  const o = MANUAL_OVERRIDES[leg.id];
  if (o != null) {
    leg.peakRating = o;
    leg.value = ratingToValue(o);
  }
}

writeFileSync(
  join(DATA, "current-squads.json"),
  JSON.stringify(curResult.players, null, 2) + "\n",
  "utf8"
);
writeFileSync(
  join(DATA, "historic-players.json"),
  JSON.stringify(histResult.players, null, 2) + "\n",
  "utf8"
);
writeFileSync(
  join(DATA, "legends.json"),
  JSON.stringify(legends, null, 2) + "\n",
  "utf8"
);

const ledger = [...curResult.ledger, ...histResult.ledger];
writeFileSync(
  join(DATA, "player-rating-research.json"),
  JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      methodology:
        "Evidence score from apps, position-normalised try rate, international tier, MOS/DT/Lance Todd/Golden Boot/Hall of Fame flags, plus 2025 official award research boosts. Peer-ranked within position (55%) and overall (45%), then mapped to target band percentiles. Explicit overrides applied last. Not a clamp or linear rescale of previous ratings.",
      currentMin: CURRENT_MIN,
      historicMin: HISTORIC_MIN,
      entries: ledger,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

// Overrides file = manual + high-confidence research awards that must stick
const allOverrides: Record<string, number> = { ...MANUAL_OVERRIDES };
for (const e of curResult.ledger) {
  if (RESEARCH_AWARD_BOOST[e.playerId] && !allOverrides[e.playerId]) {
    allOverrides[e.playerId] = e.newRating;
  }
}
// Keep notable existing elite currents as overrides for stability
for (const e of curResult.ledger) {
  if (e.newRating >= 90 && !allOverrides[e.playerId]) {
    allOverrides[e.playerId] = e.newRating;
  }
}
for (const e of histResult.ledger) {
  if ((e.newRating >= 92 || e.manualOverride) && !allOverrides[e.playerId]) {
    allOverrides[e.playerId] = e.newRating;
  }
}

writeFileSync(
  join(DATA, "player-rating-overrides.json"),
  JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      note: "Canonical overrides — mirrored to player-rating-overrides.ts",
      overrides: allOverrides,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
writeOverridesTs(allOverrides);

// Distribution report
function bandCounts(ratings: number[]): Record<string, number> {
  const bands = {
    "80-82": 0,
    "83-85": 0,
    "86-88": 0,
    "89-91": 0,
    "92-94": 0,
    "95-96": 0,
    "97-99": 0,
    below80: 0,
  };
  for (const r of ratings) {
    if (r < 80) bands.below80++;
    else if (r <= 82) bands["80-82"]++;
    else if (r <= 85) bands["83-85"]++;
    else if (r <= 88) bands["86-88"]++;
    else if (r <= 91) bands["89-91"]++;
    else if (r <= 94) bands["92-94"]++;
    else if (r <= 96) bands["95-96"]++;
    else bands["97-99"]++;
  }
  return bands;
}

const curRatings = curResult.players.map((p) => p.peakRating);
const histRatings = histResult.players.map((p) => p.peakRating);
const exact: Record<number, number> = {};
for (const r of [...curRatings, ...histRatings]) {
  exact[r] = (exact[r] ?? 0) + 1;
}

const report = {
  schemaVersion: SCHEMA_VERSION,
  current: {
    count: curRatings.length,
    min: Math.min(...curRatings),
    max: Math.max(...curRatings),
    avg: Number(
      (curRatings.reduce((a, b) => a + b, 0) / curRatings.length).toFixed(2)
    ),
    bands: bandCounts(curRatings),
    below80: curRatings.filter((r) => r < 80).length,
  },
  historic: {
    count: histRatings.length,
    min: Math.min(...histRatings),
    max: Math.max(...histRatings),
    avg: Number(
      (histRatings.reduce((a, b) => a + b, 0) / histRatings.length).toFixed(2)
    ),
    bands: bandCounts(histRatings),
    below80: histRatings.filter((r) => r < 80).length,
  },
  exactCounts: exact,
  overridesApplied: Object.keys(allOverrides).length,
  lowConfidence: ledger.filter((e) => e.confidence === "low").length,
  topCurrent: [...curResult.ledger]
    .sort((a, b) => b.newRating - a.newRating)
    .slice(0, 15)
    .map((e) => ({
      name: e.playerName,
      rating: e.newRating,
      note: e.honoursUsed[0] ?? e.evidenceSummary,
    })),
  bottomCurrent: [...curResult.ledger]
    .sort((a, b) => a.newRating - b.newRating)
    .slice(0, 10)
    .map((e) => ({ name: e.playerName, rating: e.newRating })),
};

writeFileSync(
  join(DATA, "player-rating-rebalance-v3-report.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
console.log(
  `\nWrote current/historic/legends JSON, research ledger, overrides, report.`
);
