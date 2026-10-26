/**
 * Social features (v1.19): challenge links, Daily pick rarity, Records derivation.
 * Run: bun scripts/test-social.ts  (or npx tsx scripts/test-social.ts)
 */
import {
  buildChallengePayload,
  challengeBannerText,
  challengeChecksum,
  challengeHref,
  challengeLiveGate,
  compareChallengeSides,
  decodeChallenge,
  encodeChallenge,
  formatChallengeFinish,
  inferChallengeSource,
  type ChallengePayload,
} from "../src/lib/challenge-link";
import {
  buildPickRarity,
  findRarestPick,
  formatPickPercent,
  parsePickRarityRows,
  pickRarityLabel,
} from "../src/lib/pick-rarity";
import { deriveRecords, formatWinPct, upsertRunHistory, normalizeRunHistory, type RunHistoryEntry } from "../src/lib/records";
import { buildShareResultText, type ShareMatchResult } from "../src/lib/share-result";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`  FAIL ${name}`, detail ?? "");
  }
}
function eq(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const ids = [
  "wigan-cur-jai-field",
  "st-helens-cur-jack-welsby",
  "leeds-cur-ash-handley",
  "",
  "bradford-2003-robbie-paul",
  "hull-fc-cur-a",
  "warrington-cur-b",
  "catalans-cur-c",
  "huddersfield-cur-d",
  "salford-cur-e",
  "castleford-cur-f",
  "wakefield-cur-g",
  "leigh-cur-h",
];
const season: ShareMatchResult[] = Array.from({ length: 27 }, (_, i) => (i === 4 || i === 20 || i === 25 ? "L" : "W"));

function classic(overrides: Partial<ChallengePayload> = {}): ChallengePayload {
  return {
    ...buildChallengePayload({
      seed: "classic-1761480000000-ab12cd34-0",
      era: false,
      name: "Macauley",
      results: season,
      position: 1,
      finish: "Super League Champions",
      playoffResults: ["W", "W"],
      squad: ids.map((id, slotIndex) => ({ slotIndex, playerId: id || null })),
    }),
    ...overrides,
  };
}

console.log("challenge link: round trip");
{
  const p = classic();
  eq("record from results", [p.wins, p.losses, p.draws], [24, 3, 0]);
  eq("source is classic", [p.kind, p.key], ["classic", null]);
  const code = encodeChallenge(p);
  check("code is URL-safe", /^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(code), code);
  check("link is a reasonable length", challengeHref(code).length < 900, challengeHref(code).length);
  eq("decode === encode input", decodeChallenge(code), p);
  eq("banner", challengeBannerText(p), "Beat Macauley's 24-3");
  eq("banner for a name ending in s", challengeBannerText({ ...p, name: "James" }), "Beat James' 24-3");
  eq("finish label", formatChallengeFinish(p), "League Leaders · Champions");

  const daily = buildChallengePayload({
    seed: "daily-2026-10-26",
    era: true,
    name: "  Sam‮  ",
    results: season,
    position: 3,
    finish: "Eliminated in Semi-Final",
    playoffResults: ["W", "L"],
    squad: [{ slotIndex: 0, playerId: "x-1" }],
  });
  eq("daily source", [daily.kind, daily.key], ["daily", "2026-10-26"]);
  eq("bidi characters stripped from the name", daily.name, "Sam");
  const decodedDaily = decodeChallenge(encodeChallenge(daily));
  eq("daily round trip keeps the seed", decodedDaily?.seed, "daily-2026-10-26");
  eq("daily squad padded to 13", decodedDaily?.squad.length, 13);

  const weekly = { ...classic(), kind: "weekly" as const, key: "2026-W43", seed: "weekly-2026-W43" };
  eq("weekly round trip", decodeChallenge(encodeChallenge(weekly))?.seed, "weekly-2026-W43");
  eq("inferChallengeSource weekly", inferChallengeSource("weekly-2026-W43"), { kind: "weekly", key: "2026-W43" });

  const unicode = classic({ name: "Siôn 🏉" });
  eq("unicode name survives", decodeChallenge(encodeChallenge(unicode))?.name, "Siôn 🏉");
  eq("empty name → fallback", decodeChallenge(encodeChallenge(classic({ name: "   " })))?.name, "Your mate");
}

console.log("challenge link: tamper rejection");
{
  const p = classic();
  const code = encodeChallenge(p);
  const [b64, sum] = code.split(".") as [string, string];
  const body = new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)));
  const forged = body.replace('"r":[24,3,0,1]', '"r":[27,0,0,1]');
  check("forgery changed the body", forged !== body, body);
  const forgedB64 = btoa(forged).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  eq("edited record with the old checksum is rejected", decodeChallenge(`${forgedB64}.${sum}`), null);
  eq("missing checksum is rejected", decodeChallenge(b64), null);
  eq("wrong checksum is rejected", decodeChallenge(`${b64}.${sum === "0" ? "1" : "0"}`), null);
  eq("flipped character is rejected", decodeChallenge(`${b64.slice(0, 10)}${b64[10] === "A" ? "B" : "A"}${b64.slice(11)}.${sum}`), null);
  eq("garbage is rejected", decodeChallenge("not-a-code"), null);
  eq("empty is rejected", decodeChallenge(""), null);
  eq("null is rejected", decodeChallenge(null), null);
  eq("over-long is rejected", decodeChallenge("A".repeat(5000) + ".x"), null);

  // A correctly checksummed but impossible payload is still rejected (validation, not just the sum).
  const resign = (mutate: (o: Record<string, unknown>) => void) => {
    const o = JSON.parse(body) as Record<string, unknown>;
    mutate(o);
    const s = JSON.stringify(o);
    return `${btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${challengeChecksum(s)}`;
  };
  check("re-signed valid payload decodes (sanity)", decodeChallenge(resign(() => undefined)) !== null);
  eq("more than 27 games", decodeChallenge(resign((o) => (o.r = [27, 3, 0, 1]))), null);
  eq("position 13", decodeChallenge(resign((o) => (o.r = [24, 3, 0, 13]))), null);
  eq("play-off finish from 8th", decodeChallenge(resign((o) => (o.r = [10, 17, 0, 8]))), null);
  eq("12-card squad", decodeChallenge(resign((o) => (o.q = ids.slice(0, 12)))), null);
  eq("bad card id", decodeChallenge(resign((o) => (o.q = [...ids.slice(0, 12), "<script>"]))), null);
  eq("classic link carrying a Daily seed", decodeChallenge(resign((o) => (o.s = "daily-2026-10-26"))), null);
  eq("unknown version", decodeChallenge(resign((o) => (o.v = 2))), null);
  eq("bad day key", decodeChallenge(resign((o) => { o.k = "d"; o.y = "2026-13"; delete o.s; })), null);
  check("encode refuses an impossible payload", (() => {
    try {
      encodeChallenge(classic({ wins: 30 }));
      return false;
    } catch {
      return true;
    }
  })());
}

console.log("challenge: head to head + live gate");
{
  const base = { wins: 20, losses: 7, draws: 0, position: 2, finish: "Grand Final Runner-Up" as const };
  eq("champion beats a better record", compareChallengeSides({ ...base, wins: 18, finish: "Super League Champions" }, base), 1);
  eq("same finish → more wins", compareChallengeSides({ ...base, wins: 21 }, base), 1);
  eq("same finish + wins → higher position", compareChallengeSides({ ...base, position: 1 }, base), 1);
  eq("identical → level", compareChallengeSides(base, base), 0);
  eq("worse finish loses", compareChallengeSides({ ...base, finish: "Missed Play-Offs", position: 7 }, base), -1);
  const now = { dayKey: "2026-10-26", weekKey: "2026-W44", dailyAttemptUsed: false, weeklyAttemptUsed: false };
  eq("today's Daily before playing it", challengeLiveGate({ kind: "daily", key: "2026-10-26" }, now), "live-unplayed");
  eq("today's Daily after playing it", challengeLiveGate({ kind: "daily", key: "2026-10-26" }, { ...now, dailyAttemptUsed: true }), "ok");
  eq("yesterday's Daily", challengeLiveGate({ kind: "daily", key: "2026-10-25" }, now), "ok");
  eq("tomorrow's Daily", challengeLiveGate({ kind: "daily", key: "2026-10-27" }, now), "future");
  eq("this week's Weekly before playing it", challengeLiveGate({ kind: "weekly", key: "2026-W44" }, now), "live-unplayed");
  eq("last week's Weekly", challengeLiveGate({ kind: "weekly", key: "2026-W43" }, now), "ok");
  eq("Classic is never gated", challengeLiveGate({ kind: "classic", key: null }, now), "ok");
}

console.log("share text");
{
  const text = buildShareResultText({
    kind: "classic",
    results: season,
    leaguePosition: 1,
    playoffResults: ["W", "W"],
    playoffFinish: "Super League Champions",
    challengeHref: "/play?challenge=abc.def",
  });
  const lines = text.split("\n");
  eq("challenge link is the last line", lines[lines.length - 1], "www.27-0.co.uk/play?challenge=abc.def");
  eq("beat-my line above it", lines[lines.length - 2], "⚔️ Beat my 24-3:");
  const daily = buildShareResultText({
    kind: "daily",
    dateKey: "2026-10-26",
    results: season,
    leaguePosition: 1,
    href: "/play?daily=1",
    rarestPick: { name: "Robbie Paul", percentLabel: "0.4%" },
  });
  check("rarest pick line", daily.includes("💎 Rarest pick: Robbie Paul 0.4%"), daily);
  check("daily link kept without a challenge", daily.endsWith("www.27-0.co.uk/play?daily=1"), daily);
  const plain = buildShareResultText({ kind: "daily", dateKey: "2026-10-26", results: season, leaguePosition: 1 });
  check("no rarity line without data", !plain.includes("Rarest"), plain);
}

console.log("pick rarity");
{
  eq("0.4%", formatPickPercent(0.4), "0.4%");
  eq("0.04% → <0.1%", formatPickPercent(0.04), "<0.1%");
  eq("9.96% → 10%", formatPickPercent(9.96), "10%");
  eq("12.4% → 12%", formatPickPercent(12.4), "12%");
  eq("99.6% stays under 100", formatPickPercent(99.6), "99%");
  eq("100%", formatPickPercent(100), "100%");
  eq("0 → 0%", formatPickPercent(0), "0%");
  eq("NaN → 0%", formatPickPercent(Number.NaN), "0%");
  const rows = parsePickRarityRows([
    { slot: 0, card_id: "a", picked: "2", slot_total: "500" },
    { slot: 1, card_id: "b", picked: 60, slot_total: 500 },
    { slot: 2, card_id: "c", picked: 1, slot_total: 2 },
    { slot: 3, card_id: "zzz", picked: 9, slot_total: 500 },
    { slot: "x", card_id: "d" },
    null,
  ]);
  eq("parse drops malformed rows", rows.length, 4);
  const picks = new Map([
    [0, "a"],
    [1, "b"],
    [2, "c"],
    [3, "d"],
  ]);
  const rarity = buildPickRarity(rows, picks);
  eq("only own picks with enough sample", [...rarity.keys()].sort(), [0, 1]);
  eq("slot 0 percent", rarity.get(0)?.percent, 0.4);
  eq("label", pickRarityLabel(rarity.get(1)!), "12% picked him");
  eq("rarest is slot 0", findRarestPick(rarity)?.slot, 0);
  eq("no data → no rarest", findRarestPick(new Map()), null);
  eq("picked > total is dropped", buildPickRarity([{ slot: 0, cardId: "a", picked: 9, slotTotal: 5 }], picks).size, 0);
}

console.log("records");
{
  const run = (id: string, at: number, o: Partial<RunHistoryEntry> = {}): RunHistoryEntry => ({
    id,
    at,
    variant: "classic",
    wins: 15,
    losses: 12,
    position: 5,
    perfect: false,
    winStreak: 4,
    playoffWins: 0,
    playoffLosses: 1,
    finish: "Eliminated in Eliminator",
    rating: 80,
    squad: [{ slot: 0, label: "FB", id: `${id}-fb`, name: "Full Back", club: "Wigan Warriors", year: 2026, rating: 80 }],
    ...o,
  });
  const history = [
    run("r1", 1, { wins: 25, losses: 2, position: 1, finish: "Grand Final Runner-Up", rating: 84 }),
    run("r2", 2, { wins: 22, losses: 5, position: 2, finish: "Super League Champions", rating: 82, winStreak: 11 }),
    run("r3", 3, { rating: 91 }),
    run("r4", 4, { variant: "daily", wins: 27, losses: 0, perfect: true, position: 1, finish: null, squad: [] }),
  ];
  const stats = {
    normal: { totalSeasonsSimulated: 10, regularSeasonWins: 180, regularSeasonLosses: 90, playoffWins: 8, playoffLosses: 5, bestRecordWins: 25, bestRecordLosses: 2, longestUnbeatenRun: 9, totalPerfectSeasons: 1, superLeagueTitles: 2, leagueTitlesWon: 3 },
    eraNormal: { totalSeasonsSimulated: 2, regularSeasonWins: 30, regularSeasonLosses: 24, playoffWins: 0, playoffLosses: 1, bestRecordWins: 26, bestRecordLosses: 1, longestUnbeatenRun: 14, totalPerfectSeasons: 0, superLeagueTitles: 0, leagueTitlesWon: 1 },
    hard: undefined,
  };
  const book = {
    cards: {
      a: { name: "Jai Field", club: "Wigan Warriors", year: 2026, firstAt: 1, source: "classic" as const, times: 7 },
      b: { name: "Robbie Paul", club: "Bradford Bulls", year: 2003, firstAt: 2, source: "era" as const, times: 9 },
      c: { name: "Jack Welsby", club: "St Helens", year: 2026, firstAt: 3, source: "daily" as const, times: 7 },
    },
  };
  const r = deriveRecords({ stats, history, squadBook: book });
  eq("all-time W-L", [r.allTime.wins, r.allTime.losses, r.allTime.seasons], [210, 114, 12]);
  eq("all-time play-offs", [r.allTime.playoffWins, r.allTime.playoffLosses], [8, 6]);
  eq("by mode", [r.byMode.classic.wins, r.byMode.era.wins, r.byMode.ballKnower.seasons], [180, 30, 0]);
  eq("best season (history 27-0 Daily counts)", r.bestSeason, { wins: 27, losses: 0 });
  eq("longest win streak", r.longestWinStreak, 14);
  eq("27-0 count = stats + Daily/Weekly history", r.perfectSeasons, 2);
  eq("titles", r.titles, 2);
  eq("most drafted order (times, then name)", r.mostDrafted.map((p) => p.name), ["Robbie Paul", "Jack Welsby", "Jai Field"]);
  eq("best run = the champions (not the better record)", r.bestRun?.id, "r2");
  eq("highest rated run", r.highestRatedRun?.id, "r3");
  eq("win pct", formatWinPct(210, 114), "65%");
  eq("win pct with no games", formatWinPct(0, 0), "–");

  const empty = deriveRecords({ stats: {}, history: [], squadBook: null });
  eq("empty: no best season / run", [empty.bestSeason, empty.bestRun, empty.allTime.seasons], [null, null, 0]);

  // History upkeep: updates in place and keeps the best runs when trimming.
  let h: RunHistoryEntry[] = [];
  h = upsertRunHistory(h, run("best", 0, { finish: "Super League Champions", wins: 26, losses: 1 }), 10);
  for (let i = 1; i <= 30; i++) h = upsertRunHistory(h, run(`x${i}`, i, { wins: 5, losses: 22, position: 12, finish: "Missed Play-Offs" }), 10);
  eq("trimmed to the limit", h.length, 10);
  check("best run survives trimming", h.some((e) => e.id === "best"));
  check("newest run kept", h.some((e) => e.id === "x30"));
  h = upsertRunHistory(h, { ...h.find((e) => e.id === "x30")!, playoffWins: 2, finish: "Grand Final Runner-Up", squad: [] }, 10);
  eq("update keeps the squad when none passed", h.find((e) => e.id === "x30")?.squad.length, 1);
  eq("update applied", h.find((e) => e.id === "x30")?.finish, "Grand Final Runner-Up");
  eq("normalize drops junk", normalizeRunHistory([null, { id: "" }, { id: "ok", squad: [{ id: 1 }] }]).map((e) => [e.id, e.squad.length]), [["ok", 0]]);
  eq("normalize of non-array", normalizeRunHistory({}), []);
}

if (failures > 0) {
  console.error(`\n${failures} social check(s) failed`);
  process.exit(1);
}
console.log("\nsocial: all checks passed");
