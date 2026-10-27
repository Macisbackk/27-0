/**
 * Research-ledger entries (data/player-rating-research.json) for the season cards added by
 * scripts/fill-era-coverage-2026-10.ts, so validate-player-ratings can account for every card.
 * Re-runnable: replaces this fill's entries, leaves every other entry alone.
 *
 * Run after build-era-ratings + build-runtime-player-data: bun scripts/era-coverage-ledger.ts
 */
import fs from "node:fs";
import path from "node:path";
import { getPlayerById } from "../src/lib/players";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "..");
const D = (f: string) => path.join(ROOT, "data", f);
const TAG = "era-coverage-2026-10";

type Entry = Record<string, unknown> & { playerId: string; peakOrCurrentBasis?: string };
const ledger = JSON.parse(fs.readFileSync(D("player-rating-research.json"), "utf8")) as { entries: Entry[] } & Record<string, unknown>;
const historic = JSON.parse(fs.readFileSync(D("historic-players.json"), "utf8")) as Array<Record<string, unknown> & { id: string }>;
const eraRatings = JSON.parse(fs.readFileSync(D("era-season-ratings.json"), "utf8")) as Record<string, { to: number; why: string }>;

const kept = ledger.entries.filter((e) => e.peakOrCurrentBasis !== TAG);
const added: Entry[] = [];
for (const raw of historic) {
  if (raw.source !== TAG) continue;
  const p = getPlayerById(raw.id);
  const finalRating = p?.peakRating ?? (raw.peakRating as number);
  const fresh = Boolean(raw.bioSource);
  const era = eraRatings[raw.id];
  added.push({
    playerId: raw.id,
    playerName: raw.name,
    playerType: "historic",
    position: raw.position,
    clubId: raw.club,
    previousRating: raw.peakRating,
    newRating: finalRating,
    ratingTier: finalRating >= 94 ? "elite" : finalRating >= 90 ? "top" : finalRating >= 86 ? "starter" : "squad",
    evidenceSummary: fresh
      ? `${raw.club} ${raw.year} season card: in a sourced match-day 17; no other card, squad-player default rating${era ? `; era layer: ${era.why}` : ""}`
      : `${raw.club} ${raw.year} season card: in that season's verified 17 / award list; rating = nearest card (${raw.copiedFrom}) on the age curve${era ? `; era layer: ${era.why}` : ""}`,
    peakOrCurrentBasis: TAG,
    sourceNames: fresh ? ["Match line-up", "Player bio"] : ["Verified starting 17 / award list", "Nearest season card"],
    sourceUrls: [raw.sourceUrl, raw.bioSource].filter(Boolean),
    statsUsed: { nationality: raw.nationality, previousRating: raw.peakRating },
    honoursUsed: [],
    representativeEvidence: [],
    confidence: fresh ? "low" : "medium",
    evidenceScore: fresh ? 5 : 10,
  });
}
ledger.entries = [...kept, ...added];
fs.writeFileSync(D("player-rating-research.json"), `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`ledger: ${kept.length} kept + ${added.length} era-coverage entries`);
