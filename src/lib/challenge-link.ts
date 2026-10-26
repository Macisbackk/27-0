/**
 * "Challenge a mate" links: `/play?challenge=<code>` replays someone's run (same seed, same rule)
 * as an unranked Challenge run and compares the two seasons at the end. No accounts needed.
 *
 * The code is base64url(JSON) + "." + a short checksum. The checksum only makes casual edits
 * fail (a mate changing "12-15" to "27-0" in the URL): the salt ships in the client, so it is
 * tamper-evident, not tamper-proof. Challenge runs never touch a leaderboard, so a forged link
 * can only lie to the person who opens it.
 *
 * Pure (no DOM, no storage): scripts/test-social.ts covers encode/decode and tamper rejection.
 */
import type { SharePlayoffFinish, ShareMatchResult } from "./share-result";
import { formatSharePosition } from "./share-result";

export type ChallengeKind = "classic" | "daily" | "weekly";

export const CHALLENGE_SQUAD_SIZE = 13;
export const CHALLENGE_NAME_MAX = 16;
export const CHALLENGE_FALLBACK_NAME = "Your mate";

export interface ChallengePayload {
  kind: ChallengeKind;
  /** Era squads (Classic only; the Daily / Weekly rule decides for those). */
  era: boolean;
  /** Daily: "2026-10-26". Weekly: "2026-W43". Null for Classic. */
  key: string | null;
  /** The run's spin seed. Daily / Weekly seeds are derived from the key. */
  seed: string;
  /** Challenger's display name. */
  name: string;
  wins: number;
  losses: number;
  draws: number;
  /** Final league position (1-12). */
  position: number;
  finish: SharePlayoffFinish;
  /** Play-off results in order ("" when the play-offs were missed). */
  playoffs: string;
  /** Card ids by slot index (0-12); "" for an empty slot. */
  squad: string[];
}

const FINISHES: SharePlayoffFinish[] = [
  "Missed Play-Offs",
  "Eliminated in Eliminator",
  "Eliminated in Semi-Final",
  "Grand Final Runner-Up",
  "Super League Champions",
];

const SALT = "27-0:challenge:v1:";
const KIND_CODE: Record<ChallengeKind, string> = { classic: "c", daily: "d", weekly: "w" };
const CODE_KIND: Record<string, ChallengeKind> = { c: "classic", d: "daily", w: "weekly" };
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;
const CLASSIC_SEED = /^[A-Za-z0-9-]{4,64}$/;
const CARD_ID = /^[A-Za-z0-9._-]{1,80}$/;
const MAX_CODE_LENGTH = 4000;

/** Where a run's seed came from: the Daily / Weekly seeds carry their day / week key. */
export function inferChallengeSource(seed: string): { kind: ChallengeKind; key: string | null } {
  const daily = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(seed);
  if (daily) return { kind: "daily", key: daily[1]! };
  const weekly = /^weekly-(\d{4}-W\d{2})$/.exec(seed);
  if (weekly) return { kind: "weekly", key: weekly[1]! };
  return { kind: "classic", key: null };
}

export function challengeSeedFor(kind: ChallengeKind, key: string | null, seed: string): string {
  if (kind === "daily") return `daily-${key}`;
  if (kind === "weekly") return `weekly-${key}`;
  return seed;
}

/** FNV-1a 32-bit → base36. Small and dependency-free; see the note at the top. */
export function challengeChecksum(body: string): string {
  let h = 0x811c9dc5;
  const input = SALT + body;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const padded = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Trim, drop control / bidi characters and cap the length. Empty → the fallback name. */
export function cleanChallengeName(raw: unknown): string {
  if (typeof raw !== "string") return CHALLENGE_FALLBACK_NAME;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHALLENGE_NAME_MAX)
    .trim();
  return cleaned || CHALLENGE_FALLBACK_NAME;
}

function isInt(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

/** Throws on a payload that can't be a real run (used by encode; decode returns null instead). */
function validate(p: ChallengePayload): string | null {
  if (!(p.kind in KIND_CODE)) return "kind";
  if (p.kind === "daily" && !(p.key && DAY_KEY.test(p.key))) return "day key";
  if (p.kind === "weekly" && !(p.key && WEEK_KEY.test(p.key))) return "week key";
  if (p.kind === "classic") {
    if (!CLASSIC_SEED.test(p.seed)) return "seed";
    // A Classic link can't smuggle in a Daily / Weekly seed (that would dodge the live gate).
    if (inferChallengeSource(p.seed).kind !== "classic") return "seed kind";
  }
  if (!isInt(p.wins, 0, 27) || !isInt(p.losses, 0, 27) || !isInt(p.draws, 0, 27)) return "record";
  if (p.wins + p.losses + p.draws > 27) return "record total";
  if (!isInt(p.position, 1, 12)) return "position";
  if (!FINISHES.includes(p.finish)) return "finish";
  if (p.position > 6 && p.finish !== "Missed Play-Offs") return "finish vs position";
  if (!/^[WLD]{0,4}$/.test(p.playoffs)) return "playoffs";
  if (!Array.isArray(p.squad) || p.squad.length !== CHALLENGE_SQUAD_SIZE) return "squad size";
  if (!p.squad.every((id) => id === "" || CARD_ID.test(id))) return "card id";
  return null;
}

/** The compact JSON body (short keys keep the link short). */
function toBody(p: ChallengePayload): string {
  const body: Record<string, unknown> = {
    v: 1,
    k: KIND_CODE[p.kind],
    e: p.era ? 1 : 0,
    n: cleanChallengeName(p.name),
    r: [p.wins, p.losses, p.draws, p.position],
    f: FINISHES.indexOf(p.finish),
    q: p.squad,
  };
  if (p.kind === "classic") body.s = p.seed;
  else body.y = p.key;
  if (p.playoffs) body.p = p.playoffs;
  return JSON.stringify(body);
}

export function encodeChallenge(payload: ChallengePayload): string {
  const problem = validate(payload);
  if (problem) throw new Error(`challenge: invalid ${problem}`);
  const body = toBody(payload);
  return `${toBase64Url(body)}.${challengeChecksum(body)}`;
}

/** Null for anything malformed, tampered with or impossible. Never throws. */
export function decodeChallenge(code: string | null | undefined): ChallengePayload | null {
  if (!code || typeof code !== "string" || code.length > MAX_CODE_LENGTH) return null;
  const dot = code.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = fromBase64Url(code.slice(0, dot));
  if (!body || challengeChecksum(body) !== code.slice(dot + 1)) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  const kind = CODE_KIND[String(raw.k)];
  if (!kind) return null;
  const r = Array.isArray(raw.r) ? raw.r : [];
  const key = kind === "classic" ? null : typeof raw.y === "string" ? raw.y : "";
  const payload: ChallengePayload = {
    kind,
    era: raw.e === 1,
    key,
    seed: challengeSeedFor(kind, key, typeof raw.s === "string" ? raw.s : ""),
    name: cleanChallengeName(raw.n),
    wins: r[0] as number,
    losses: r[1] as number,
    draws: r[2] as number,
    position: r[3] as number,
    finish: FINISHES[raw.f as number] as SharePlayoffFinish,
    playoffs: typeof raw.p === "string" ? raw.p : "",
    squad: Array.isArray(raw.q) ? (raw.q as string[]) : [],
  };
  return validate(payload) ? null : payload;
}

export function challengeHref(code: string): string {
  return `/play?challenge=${code}`;
}

/** Build a payload from a finished run. Squad entries are by slot index. */
export function buildChallengePayload(input: {
  seed: string;
  era: boolean;
  name: string;
  results: readonly ShareMatchResult[];
  position: number;
  finish: SharePlayoffFinish | null | undefined;
  playoffResults?: readonly ShareMatchResult[] | null;
  squad: readonly { slotIndex: number; playerId: string | null | undefined }[];
}): ChallengePayload {
  const { kind, key } = inferChallengeSource(input.seed);
  const squad = Array.from({ length: CHALLENGE_SQUAD_SIZE }, () => "");
  for (const s of input.squad) {
    if (s.slotIndex >= 0 && s.slotIndex < CHALLENGE_SQUAD_SIZE && s.playerId) squad[s.slotIndex] = s.playerId;
  }
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const r of input.results) {
    if (r === "W") wins++;
    else if (r === "L") losses++;
    else if (r === "D") draws++;
  }
  return {
    kind,
    era: input.era,
    key,
    seed: input.seed,
    name: cleanChallengeName(input.name),
    wins,
    losses,
    draws,
    position: input.position,
    finish: input.finish ?? "Missed Play-Offs",
    playoffs: (input.playoffResults ?? []).join("").slice(0, 4),
    squad,
  };
}

export function formatChallengeRecord(p: Pick<ChallengePayload, "wins" | "losses" | "draws">): string {
  return p.draws > 0 ? `${p.wins}-${p.losses}-${p.draws}` : `${p.wins}-${p.losses}`;
}

/** "Beat Macauley's 24-3". */
export function challengeBannerText(p: Pick<ChallengePayload, "name" | "wins" | "losses" | "draws">): string {
  const name = cleanChallengeName(p.name);
  const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
  return `Beat ${possessive} ${formatChallengeRecord(p)}`;
}

export function formatChallengeFinish(p: Pick<ChallengePayload, "position" | "finish">): string {
  const table = formatSharePosition(p.position);
  switch (p.finish) {
    case "Super League Champions":
      return `${table} · Champions`;
    case "Grand Final Runner-Up":
      return `${table} · Grand Final`;
    case "Eliminated in Semi-Final":
      return `${table} · Semi-final`;
    case "Eliminated in Eliminator":
      return `${table} · Eliminator`;
    default:
      return `${table} · No play-offs`;
  }
}

export interface ChallengeSide {
  wins: number;
  losses: number;
  draws: number;
  position: number;
  finish: SharePlayoffFinish;
}

/**
 * Who won the head-to-head: the play-off finish first (the Grand Final decides the title in rugby
 * league), then regular-season wins, then the league position. 1 = `mine` wins, -1 = theirs, 0 = level.
 */
export function compareChallengeSides(mine: ChallengeSide, theirs: ChallengeSide): 1 | -1 | 0 {
  const byFinish = FINISHES.indexOf(mine.finish) - FINISHES.indexOf(theirs.finish);
  if (byFinish !== 0) return byFinish > 0 ? 1 : -1;
  if (mine.wins !== theirs.wins) return mine.wins > theirs.wins ? 1 : -1;
  if (mine.position !== theirs.position) return mine.position < theirs.position ? 1 : -1;
  return 0;
}

/**
 * A link to a Daily / Weekly that is still live must not become a free preview of it. Returns
 * "future" for a day / week that hasn't started (forged or clock skew), "live-unplayed" when it's
 * today's Daily / this week's Weekly and the opener hasn't used their ranked attempt, else "ok".
 */
export function challengeLiveGate(
  p: Pick<ChallengePayload, "kind" | "key">,
  now: { dayKey: string; weekKey: string; dailyAttemptUsed: boolean; weeklyAttemptUsed: boolean }
): "ok" | "future" | "live-unplayed" {
  if (p.kind === "daily" && p.key) {
    if (p.key > now.dayKey) return "future";
    if (p.key === now.dayKey && !now.dailyAttemptUsed) return "live-unplayed";
  }
  if (p.kind === "weekly" && p.key) {
    if (p.key > now.weekKey) return "future";
    if (p.key === now.weekKey && !now.weeklyAttemptUsed) return "live-unplayed";
  }
  return "ok";
}
