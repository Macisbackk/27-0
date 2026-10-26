/**
 * Coach-name filter tests (App Review 1.2 moderation):
 *  - blocks profanity, slurs and sexual terms in their common disguises (leetspeak, repeated
 *    letters, separators, camelCase);
 *  - passes every player and club name in the game's data, typed the ways a coach name can be
 *    ("Theo Fages", "Theo_Fages", "TheoFages");
 *  - passes a list of ordinary names and words;
 *  - the SQL copy of the word lists in the moderation migration matches blocked-terms.ts;
 *  - validateCoachName() rejects a blocked name with the friendly message;
 *  - the hidden-coaches list merges by latest change and keeps unhides.
 * Run: npx tsx scripts/test-name-filter.ts   (or bun scripts/test-name-filter.ts)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  checkNameContent,
  displayCoachName,
  maskedCoachName,
  OFFENSIVE_NAME_MESSAGE,
} from "../src/lib/moderation/name-filter";
import {
  ALLOWED_SUBSTRINGS,
  ALLOWED_TOKENS,
  BLOCKED_SUBSTRINGS,
  BLOCKED_WORDS,
} from "../src/lib/moderation/blocked-terms";
import { validateCoachName } from "../src/lib/storage/user";
import { mergeHiddenCoaches, type HiddenCoachesState } from "../src/lib/moderation/hidden-coaches-merge";

const ROOT = process.cwd();
let failures = 0;
let checks = 0;
function check(ok: boolean, message: string) {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  FAIL ${message}`);
  }
}

/* ------------------------------------------------------------------ blocked */

const BLOCKED = [
  // plain
  "fuck", "Fucker", "MotherFucker", "cunt", "Shithead", "wanker", "Twat", "bollocks", "bastard",
  "Bitch", "tosser", "bellend", "knobhead", "dickhead", "Arsehole", "asshole", "pisshead",
  "nigger", "nigga", "faggot", "Retard", "spastic", "tranny", "paki", "Pakis", "coon", "wog",
  "hitler", "SiegHeil", "nazi", "pussy", "penis", "dildo", "porn", "Whore", "slut", "rapist",
  "paedo", "nonce", "cum", "Ass", "arse", "cock", "prick", "slag", "fanny", "fag", "spaz", "mong",
  "JihadJohn",
  // leetspeak
  "sh1t", "5hit", "Sh1tHead", "fvck_no", "f4gg0t", "n1gger", "c0ck", "@ss", "a55", "a$$hole",
  "b1tch", "wank3r", "pr1ck", "p0rn", "d1ld0", "cun7", "5lut", "r3tard", "h1tler", "Fuk_Off",
  // repeated letters
  "fuuuuck", "shiiiit", "cuuuunt", "aaasss", "wankkkker", "niiiigger",
  // separators and spacing
  "f_u_c_k", "F u c k", "s.h.i.t", "c-u-n-t", "Fu_ck", "Wan_Ker", "a_s_s", "As_S", "Big_Dick_Energy",
  "BigDickEnergy", "bigdick", "Jihad_John", "Twat_Face",
  // embedded
  "xXFuckXx", "TheShitCoach", "Coach_Cunt", "BigWanker", "SuckMyDick", "Ass_Kicker", "Cocks4Life",
  "ScunthorpeCunt", "Cum_Shot", "Raping_Machine", "Nazis_RL", "Coach1488",
];
for (const name of BLOCKED) {
  const r = checkNameContent(name);
  check(!r.ok, `should block ${JSON.stringify(name)}`);
}

/* ------------------------------------------------------------------ ordinary names */

const ALLOWED = [
  "Scunthorpe", "Scunthorpe_RL", "Penistone", "Hancock", "Peacock", "Woodcock", "Babcock", "Alcock",
  "Hitchcock", "Cockburn", "Cockayne", "Cocker", "Cocky_Coach", "Dick", "Dick_Huddart", "Dickinson",
  "Dickens", "Dickie", "Nobby", "Nobby_Stiles", "Spencer", "Spicer", "Cumming", "Cummings",
  "Cumbria", "Document", "Essex", "Sussex", "Middlesex", "Bass", "Cassidy", "Classic", "Grass",
  "Passmore", "Massey", "Assistant", "Arsenal", "Parsons", "Therapist", "Grape", "Drape",
  "Scrapper", "Titan", "Title_Winner", "Constitution", "Analyst", "Canal", "Janus", "Shitake",
  "Swanky", "Hitchin", "Ashton", "Mitchell", "Josh_Itaka", "Sexton", "Sussex_Sharks",
  "Coonan", "Wogan", "Pakistan", "Niger", "Nigel", "Cockermouth", "Clitheroe",
  "Matsuhita", "Homer", "Homes", "Monger", "Shaggy", "Spicy", "Raper_no",
  "Coach_2024", "Bradford_Bull", "Wigan_Warrior", "Saints_Fan", "Rhinos4Life",
  "Hull_KR", "Castleford", "Wakefield_Trinity", "Leigh_Leopards", "Warrington_Wolves",
  "Catalans", "Huddersfield", "Salford_Red_Devil", "Widnes_Vikings", "Featherstone", "Batley",
  "Dewsbury", "Halifax", "Oldham", "Swinton", "Whitehaven", "Workington", "Barrow", "Keighley",
  "Toulouse", "London_Broncos", "Sheffield_Eagles", "York_Knights", "Doncaster", "Hunslet",
  "Big_Coach", "Coach_Dave", "SuperCoach", "TheGaffer", "RugbyLeagueFan", "Hooker_9", "Prop_Forward",
  "Loose_Forward", "Scrum_Half", "Stand_Off", "Full_Back", "Golden_Point", "Grand_Final",
  "Mo_Shah", "Sam_Burgess", "Kevin_Sinfield", "Sean_Long", "Jamie_Peacock", "Ellery_Hanley",
  "Martin_Offiah", "Shaun_Edwards", "Andy_Farrell", "Paul_Sculthorpe", "Coach #0042",
];
for (const name of ALLOWED) {
  const r = checkNameContent(name);
  check(r.ok, `should allow ${JSON.stringify(name)} (matched ${r.term})`);
}

// Known trade-offs (blocked on purpose): one-word "Joshitaka" (contains "shit"), "Snigger",
// "Dyke_Road", and numbers that read as words in leetspeak ("455" -> "ass").
for (const name of ["Joshitaka", "Snigger", "Dave_455"]) {
  check(!checkNameContent(name).ok, `known trade-off still blocked: ${name}`);
}

/* ------------------------------------------------------------------ game data */

const NAME_KEYS = new Set([
  "name", "fullName", "displayName", "club", "team", "clubName", "shortName", "teamName",
  "nickname", "firstName", "lastName", "player", "playerName", "opponent", "homeTeam",
  "awayTeam", "winner", "runnerUp",
]);
const gameNames = new Set<string>();
function walk(value: unknown, key?: string) {
  if (typeof value === "string") {
    if (key && NAME_KEYS.has(key) && value.length < 80) gameNames.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walk(v, k);
  }
}
function walkDir(dir: string) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walkDir(path);
    else if (entry.endsWith(".json")) {
      try {
        walk(JSON.parse(readFileSync(path, "utf8")));
      } catch {
        /* not JSON data */
      }
    }
  }
}
walkDir(join(ROOT, "data"));
walkDir(join(ROOT, "src"));
check(gameNames.size > 2000, `expected the game's player and club names (found ${gameNames.size})`);
let gameBlocked = 0;
for (const name of gameNames) {
  const typed = [name, name.replace(/[^A-Za-z0-9]+/g, "_"), name.replace(/[^A-Za-z0-9]+/g, "")];
  for (const t of typed) {
    const r = checkNameContent(t);
    if (!r.ok) {
      gameBlocked++;
      check(false, `real name blocked: ${JSON.stringify(t)} (matched ${r.term})`);
    }
  }
}

/* ------------------------------------------------------------------ SQL copy */

const migration = readFileSync(
  join(ROOT, "supabase/migrations/20261026120000_moderation.sql"),
  "utf8"
);
function sqlList(name: string): string[] {
  const m = migration.match(new RegExp(`${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([\\s\\S]*?)\\]`));
  if (!m) {
    check(false, `migration has no ${name} array`);
    return [];
  }
  return [...m[1]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!);
}
const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");
check(same(sqlList("blocked_substrings"), BLOCKED_SUBSTRINGS), "SQL blocked_substrings matches blocked-terms.ts");
check(same(sqlList("blocked_words"), BLOCKED_WORDS), "SQL blocked_words matches blocked-terms.ts");
check(same(sqlList("allowed_substrings"), ALLOWED_SUBSTRINGS), "SQL allowed_substrings matches blocked-terms.ts");
check(same(sqlList("allowed_tokens"), ALLOWED_TOKENS), "SQL allowed_tokens matches blocked-terms.ts");
for (const term of [...BLOCKED_SUBSTRINGS, ...BLOCKED_WORDS, ...ALLOWED_SUBSTRINGS, ...ALLOWED_TOKENS]) {
  check(/^[a-z]+$/.test(term), `term ${JSON.stringify(term)} is lowercase a-z`);
}

/* ------------------------------------------------------------------ app wiring */

const v = validateCoachName("Sh1tHead");
check(!v.valid && v.error === OFFENSIVE_NAME_MESSAGE, "validateCoachName rejects a blocked name with the friendly message");
check(validateCoachName("Hancock").valid, "validateCoachName accepts Hancock");
check(validateCoachName("ab").error !== OFFENSIVE_NAME_MESSAGE, "format errors still come first");

// Same number as the SQL coach_name_masked(): first 8 hex digits of the uuid, mod 10000.
check(maskedCoachName("0a1b2c3d-0000-0000-0000-000000000000") === "Coach #2957", "masked name from user id");
check(maskedCoachName("ffffffff-0000-0000-0000-000000000000") === "Coach #7295", "masked name is unsigned");
check(/^Coach #\d{4}$/.test(maskedCoachName(null, "whatever")), "masked name without a user id");
check(displayCoachName("Hancock", "x") === "Hancock", "display keeps an allowed name");
check(displayCoachName("fuuuck", "0a1b2c3d-1111") === "Coach #2957", "display masks a blocked name");
check(checkNameContent(maskedCoachName("80080000-0000-0000-0000-000000000000")).ok, "masked names always pass");

/* ------------------------------------------------------------------ hidden coaches merge */

const a: HiddenCoachesState = {
  coaches: [
    { userId: "u1", name: "One", hidden: true, changedAt: "2026-10-01T00:00:00.000Z" },
    { userId: "u2", name: "Two", hidden: false, changedAt: "2026-10-05T00:00:00.000Z" },
  ],
};
const b: HiddenCoachesState = {
  coaches: [
    { userId: "u2", name: "Two", hidden: true, changedAt: "2026-10-02T00:00:00.000Z" },
    { userId: "u3", name: "Three", hidden: true, changedAt: "2026-10-03T00:00:00.000Z" },
  ],
};
const merged = mergeHiddenCoaches(a, b);
const byId = new Map(merged.coaches.map((c) => [c.userId, c]));
check(byId.get("u1")?.hidden === true, "merge keeps a local-only hide");
check(byId.get("u3")?.hidden === true, "merge keeps a cloud-only hide");
check(byId.get("u2")?.hidden === false, "merge keeps the later unhide over an older hide");
check(mergeHiddenCoaches(b, a).coaches.find((c) => c.userId === "u2")?.hidden === false, "merge is order independent");
check(mergeHiddenCoaches(a, null).coaches.length === 2, "merge with no cloud copy keeps local");
check(mergeHiddenCoaches({ coaches: [{ bogus: 1 }] } as unknown, "junk").coaches.length === 0, "merge drops junk");

console.log(
  `name filter: ${checks - failures}/${checks} checks passed · ${BLOCKED.length} blocked variants · ${ALLOWED.length} ordinary names · ${gameNames.size} game names (${gameBlocked} blocked)`
);
if (failures > 0) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
