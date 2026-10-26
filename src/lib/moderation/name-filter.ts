/**
 * Coach-name content filter (App Review 1.2: filter objectionable user-generated content).
 *
 * Coach names are public on every leaderboard, so a name is checked when it is set (sign-up,
 * profile) and a name that fails is shown as "Coach #1234" wherever it is displayed. The database
 * enforces a simplified copy of the same rules (supabase/migrations/20261026120000_moderation.sql),
 * so a client that skips this check still can't save a blocked name.
 *
 * How a name is read:
 *  1. Accents stripped, camelCase split ("BigDick" -> "big dick").
 *  2. Leetspeak mapped (0->o 1->i/l 3->e 4->a 5->s 7->t 8->b 9->g @->a $->s !->i); everything that
 *     is not a letter is a separator. A copy with digits simply dropped is checked too.
 *  3. Repeated letters are tolerated by the patterns ("fuuuck" matches "fuck").
 *  4. BLOCKED_SUBSTRINGS match inside any word, and across separators when one side of the break is
 *     a short fragment ("f_u_c_k", "Fu_ck") or the match starts or ends on a word edge
 *     ("Jihad_John"), but not across the middle of two real words ("Josh_Itaka").
 *  5. BLOCKED_WORDS match only a whole word, plus plain suffixes ("ass", "asses"; not "Bass").
 *  6. ALLOWED_SUBSTRINGS (Scunthorpe, Penistone …) are blanked before step 4; ALLOWED_TOKENS
 *     ("cocky", "Spicer" …) are skipped in step 5.
 */
import {
  ALLOWED_SUBSTRINGS,
  ALLOWED_TOKENS,
  BLOCKED_SUBSTRINGS,
  BLOCKED_WORDS,
} from "./blocked-terms";

export const OFFENSIVE_NAME_MESSAGE =
  "That coach name isn't allowed on the public leaderboards. Please choose a different one.";

/** Plain suffixes a BLOCKED_WORDS term may carry and still count as that word. */
export const WORD_SUFFIXES = ["s", "es", "ed", "d", "er", "ers", "ing", "y", "ie", "ies", "z"] as const;

const BASE_LEET: Record<string, string> = {
  "0": "o",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "+": "t",
};

/** Each spelling of the name that is checked: "1" read as i, as l, and digits dropped. */
const LEET_VARIANTS: Array<Record<string, string>> = [
  { ...BASE_LEET, "1": "i", "|": "i" },
  { ...BASE_LEET, "1": "l", "|": "l" },
  {},
];

/** "fuck" -> "f+u+c+k+": each letter may repeat. */
export function termPattern(term: string): string {
  return [...term].map((ch) => `${ch}+`).join("");
}

const SUBSTRING_RE = BLOCKED_SUBSTRINGS.map((term) => ({ term, re: new RegExp(termPattern(term), "g") }));
const WORD_RE = new RegExp(
  `^(${BLOCKED_WORDS.map(termPattern).join("|")})(${WORD_SUFFIXES.join("|")})?$`
);
const ALLOWED_SUBSTRING_RE = ALLOWED_SUBSTRINGS.length
  ? new RegExp(ALLOWED_SUBSTRINGS.join("|"), "g")
  : null;
const ALLOWED_TOKEN_SET = new Set(ALLOWED_TOKENS);

/** Words of the name in one leet spelling, lowercase a–z, allowlisted parts blanked with "#". */
export function nameTokens(raw: string, leet: Record<string, string>): string[] {
  const spaced = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  let mapped = "";
  for (const ch of spaced) {
    if (/[a-zA-Z]/.test(ch)) mapped += ch.toLowerCase();
    else mapped += leet[ch] ?? " ";
  }
  return mapped
    .split(/ +/)
    .filter(Boolean)
    .map((t) => (ALLOWED_SUBSTRING_RE ? t.replace(ALLOWED_SUBSTRING_RE, "#") : t));
}

function substringHit(tokens: string[]): string | null {
  const compact = tokens.join("");
  // Start offset of each token in `compact`.
  const starts: number[] = [];
  let pos = 0;
  for (const t of tokens) {
    starts.push(pos);
    pos += t.length;
  }
  const tokenAt = (i: number) => {
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1]! <= i) k++;
    return k;
  };
  for (const { term, re } of SUBSTRING_RE) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(compact))) {
      const first = tokenAt(m.index);
      const last = tokenAt(m.index + m[0].length - 1);
      if (first === last) return term;
      // Across a break: when one of the pieces is a short fragment ("Fu_ck", "f_u_c_k"), or the
      // match starts or ends on a word edge ("Jihad_John", "Big_Dick"). Not "Josh_Itaka".
      for (let k = first; k <= last; k++) {
        if (tokens[k]!.length <= 3) return term;
      }
      const end = m.index + m[0].length;
      if (starts[first] === m.index || starts[last]! + tokens[last]!.length === end) return term;
      re.lastIndex = m.index + 1;
    }
  }
  return null;
}

function wordHit(tokens: string[]): string | null {
  const candidates = [...tokens];
  // Runs of 1–2 letter pieces read as one word ("a_s_s", "As_S").
  let run: string[] = [];
  const flush = () => {
    if (run.length > 1) candidates.push(run.join(""));
    run = [];
  };
  for (const t of tokens) {
    if (t.length <= 2) run.push(t);
    else flush();
  }
  flush();
  for (const c of candidates) {
    if (ALLOWED_TOKEN_SET.has(c)) continue;
    const m = WORD_RE.exec(c);
    if (m) return m[1]!;
  }
  return null;
}

export interface NameCheck {
  ok: boolean;
  /** The blocked term that matched (for tests and logs; never shown to the player). */
  term?: string;
}

/** The stand-in maskedCoachName() makes ("Coach #0042"); always allowed. */
const MASKED_NAME_RE = /^Coach #\d{4}$/;

export function checkNameContent(name: string): NameCheck {
  if (MASKED_NAME_RE.test(name)) return { ok: true };
  if (/1488/.test(name)) return { ok: false, term: "1488" };
  for (const leet of LEET_VARIANTS) {
    const tokens = nameTokens(name, leet);
    const hit = substringHit(tokens) ?? wordHit(tokens);
    if (hit) return { ok: false, term: hit };
  }
  return { ok: true };
}

export function isNameAllowed(name: string): boolean {
  return checkNameContent(name).ok;
}

/**
 * Stand-in shown for a hidden or blocked name: "Coach #1234", the number taken from the user id
 * (the database's coach_name_masked() makes the same one), else from the name.
 */
export function maskedCoachName(userId?: string | null, name?: string): string {
  let n: number;
  const hex = userId?.replace(/-/g, "").slice(0, 8);
  if (hex && /^[0-9a-f]{8}$/i.test(hex)) {
    n = Number.parseInt(hex, 16) % 10000;
  } else {
    let h = 0;
    for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    n = h % 10000;
  }
  return `Coach #${String(n).padStart(4, "0")}`;
}

/** The name to show on a public board: the coach's name, or "Coach #1234" if it fails the filter. */
export function displayCoachName(name: string, userId?: string | null): string {
  return isNameAllowed(name) ? name : maskedCoachName(userId, name);
}
