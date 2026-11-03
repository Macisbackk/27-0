/**
 * Current-card rating scale (Nov 2026 rescale, data/current-ratings-2026-11.md).
 *
 * - every current (2026) card is rated 70–99; every era (historic) and legend card stays 80–99
 * - the spread is real: ≥ 20% of playable current cards under 80, ≥ 5% at 90+, ≥ 2% at 92+,
 *   some at 70–72, and no single rating holds more than 12% of the cards (no new floor pile-up)
 * - every current card has a researched entry in data/current-ratings-2026.json and the loader
 *   applies it; the old research order holds (an 82+ card two+ old points higher never ends
 *   lower, and no old-floor card passes 80)
 * - downstream: values rise with rating across 70–99, every rating lands in exactly one Showcase
 *   band, the out-of-position floor is 70 for current cards and 80 for era cards
 *
 * Run: npm run test:current-ratings   (or: bun scripts/test-current-ratings.ts)
 */
import CURRENT_RATINGS from "../data/current-ratings-2026.json";
import { getAllDatabasePlayers, getShowcasePlayers } from "../src/lib/players";
import { computePlayerValue } from "../src/lib/players/ratings";
import { RATING_FILTER_LABELS, type RatingFilter, filterShowcasePlayers } from "../src/lib/players/showcase";
import { applyOutOfPositionPenalty, getPlayerRatingForPosition } from "../src/lib/players/player-positions";
import { CURRENT_MIN_RATING, HISTORIC_MIN_RATING } from "../src/lib/players/rating-floors";
import type { Player } from "../src/lib/types";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const rescale = CURRENT_RATINGS as Record<string, { to: number; from: number; why: string }>;
const all = getAllDatabasePlayers();
const current = all.filter((p) => p.category === "current");
const era = all.filter((p) => p.category === "historic");
const legends = all.filter((p) => p.category === "legend");
const playable = getShowcasePlayers().filter((p) => p.category === "current");

// --- Ranges ---------------------------------------------------------------------------------
{
  const bad = current.filter((p) => p.peakRating < 70 || p.peakRating > 99 || !Number.isInteger(p.peakRating));
  assert(CURRENT_MIN_RATING === 70 && HISTORIC_MIN_RATING === 80, "floors: current 70, era 80");
  assert(bad.length === 0, `every current card is 70–99 (${current.length} cards${bad.length ? `; bad: ${bad.slice(0, 5).map((p) => `${p.id} ${p.peakRating}`).join(", ")}` : ""})`);
  const badEra = [...era, ...legends].filter((p) => p.peakRating < 80 || p.peakRating > 99);
  assert(badEra.length === 0, `every era and legend card is 80–99 (${era.length + legends.length} cards)`);
  assert(Math.min(...legends.map((p) => p.peakRating)) >= 84, "legend cards keep their 84+ range");
}

// --- Spread ---------------------------------------------------------------------------------
{
  const n = playable.length;
  const share = (f: (p: Player) => boolean) => playable.filter(f).length / n;
  const under80 = share((p) => p.peakRating < 80);
  const ninety = share((p) => p.peakRating >= 90);
  const elite = share((p) => p.peakRating >= 92);
  const academy = share((p) => p.peakRating <= 72);
  const counts = new Map<number, number>();
  for (const p of playable) counts.set(p.peakRating, (counts.get(p.peakRating) ?? 0) + 1);
  const [topRating, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  assert(under80 >= 0.2, `≥ 20% of playable current cards are under 80 (${pct(under80)})`);
  assert(ninety >= 0.05, `≥ 5% of playable current cards are 90+ (${pct(ninety)})`);
  assert(elite >= 0.02, `≥ 2% are 92+ elite (${pct(elite)})`);
  assert(academy >= 0.03, `the academy end (70–72) is used (${pct(academy)})`);
  assert(topCount / n <= 0.12, `no rating holds more than 12% of cards (most common ${topRating}: ${pct(topCount / n)})`);
}

// --- Source and order -----------------------------------------------------------------------
{
  const missing = current.filter((p) => !rescale[p.id]);
  assert(missing.length === 0, `every current card has a rescale entry (${missing.length} missing)`);
  const notApplied = current.filter((p) => rescale[p.id] && rescale[p.id]!.to !== p.peakRating);
  assert(notApplied.length === 0, `the loader applies the rescale (${notApplied.length} differ)`);
  const extra = Object.keys(rescale).filter((id) => !current.some((p) => p.id === id));
  assert(extra.length === 0, `no rescale entry for a non-current card (${extra.length})`);

  const rows = Object.values(rescale);
  let inversions = 0;
  // Cards rated from their research (not the few "-hist-" ids with no 2026 squad, see the doc).
  const researched = rows.filter((r) => r.why.startsWith("researched"));
  for (const a of researched) for (const b of rows) if (a.from >= 82 && a.from >= b.from + 2 && a.to < b.to) inversions++;
  assert(inversions === 0, "researched order holds: an 82+ card 2+ old points higher never ends lower");
  assert(
    researched.filter((r) => r.from === 81).every((r) => r.to >= 79 && r.to <= 81),
    "old 81s land 79–81 (level with the best old-floor rotation men at 79–80)"
  );
  const floorUp = rows.filter((r) => r.from <= 80 && r.to > 80);
  assert(floorUp.length === 0, "no old-floor (80) card passes 80");
  const eraUntouched = era.every((p) => !rescale[p.id]);
  assert(eraUntouched, "era cards are not touched by the rescale");
}

// --- Downstream -----------------------------------------------------------------------------
{
  let monotone = true;
  for (let r = 70; r < 81; r++) {
    if (computePlayerValue(r + 1, "CENTRE", "current") <= computePlayerValue(r, "CENTRE", "current")) monotone = false;
  }
  assert(monotone, "player value rises with every point from 70 to 81 (the new current range below the era floor)");
  assert(
    computePlayerValue(70, "PROP", "current") < computePlayerValue(80, "PROP", "current") &&
      computePlayerValue(80, "PROP", "current") < computePlayerValue(90, "PROP", "current"),
    "fringe < rotation < elite in value"
  );

  const bands = Object.keys(RATING_FILTER_LABELS) as Exclude<RatingFilter, "all">[];
  const base = { search: "", status: "all" as const, position: "all" as const, club: "all", year: "all" as const, tier: "all" as const };
  const seen = new Map<string, number>();
  for (const band of bands) {
    for (const p of filterShowcasePlayers(playable, { ...base, ratingMin: band })) {
      seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
    }
  }
  assert(
    playable.every((p) => seen.get(p.id) === 1),
    `every playable current card sits in exactly one Showcase rating band (${bands.map((b) => RATING_FILTER_LABELS[b]).join(", ")})`
  );

  const fringe = playable.find((p) => p.peakRating === 72 && p.position === "PROP");
  const starter = playable.find((p) => p.peakRating === 85 && p.position === "PROP");
  const eraCard = era.find((p) => p.peakRating === 84 && p.position === "PROP");
  if (fringe) assert(getPlayerRatingForPosition(fringe, "WING") === 70, "a 72 current prop on the wing drops to the 70 floor");
  if (starter) assert(getPlayerRatingForPosition(starter, "WING") === 80, "an 85 current prop on the wing takes the full −5");
  if (eraCard) assert(getPlayerRatingForPosition(eraCard, "WING") === 80, "an 84 era prop on the wing keeps the era 80 floor");
  assert(applyOutOfPositionPenalty(66) === 65 && applyOutOfPositionPenalty(84) === 80, "rating-only penalty unchanged (80 / 65 floors)");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
