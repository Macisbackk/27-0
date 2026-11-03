/**
 * Word lists for the coach-name filter (name-filter.ts). Data only — the matching rules live in
 * name-filter.ts, and the SQL copy in supabase/migrations/20261026120000_moderation.sql must
 * contain the same terms (scripts/test-name-filter.ts checks it does).
 *
 * All terms are lowercase a–z only. Matching tolerates repeated letters ("fuuuck"), leetspeak
 * ("sh1t", "@ss") and separators ("f_u_c_k"), so list each word once in its plain spelling.
 *
 * When adding a word, run `npm run test:moderation`: it checks every player and club name in the
 * game's data still passes. A real name that trips a SUBSTRING term goes in ALLOWED_SUBSTRINGS; a
 * real word that trips a WHOLE_WORD term goes in ALLOWED_TOKENS.
 */

/**
 * Blocked anywhere inside a word ("xXfuckerXx", "bigwanker"). Only words that are almost never
 * part of an innocent word or surname belong here.
 */
export const BLOCKED_SUBSTRINGS: readonly string[] = [
  // Profanity
  "fuck", "fuk", "fck", "fcuk", "fvck", "phuck", "phuk", "fuq",
  "cunt", "kunt",
  "shit", "shyt",
  "wank",
  "bollock", "bollox",
  "bastard",
  "bitch", "biatch",
  "twat",
  "tosser", "tosspot",
  "bellend",
  "knobhead", "nobhead", "knobend",
  "dickhead", "dickface", "dicksuck", "dickpic", "bigdick", "mydick", "suckmydick",
  "cocksuck", "cockhead", "bigcock", "mycock",
  "asshole", "arsehole", "arsewipe", "dumbass", "jackass", "fatass", "asshat", "assclown", "asswipe",
  "pisshead", "pissflaps",
  "motherf",
  "bugger",
  "shithead",
  // Sexual
  "pussy", "penis", "vagina", "dildo", "porn", "jizz", "spunk", "boob",
  "blowjob", "handjob", "rimjob", "cumshot", "cumslut", "creampie", "gangbang", "bukkake",
  "deepthroat", "orgasm", "horny", "erection", "masturbat", "hentai", "nudes", "whore", "slut",
  "skank", "rapist", "paedo", "pedophil", "paedophil", "incest", "bestiality",
  // Slurs and hate
  "nigger", "nigga", "niggah", "nigguh", "faggot", "fagot", "retard", "spastic", "spacker", "spakka",
  "tranny", "shemale", "poofter", "battyboy", "battyman", "golliwog", "raghead", "towelhead",
  "wetback", "beaner", "gyppo", "pikey", "windowlicker",
  "hitler", "siegheil", "heilhitler", "nazis", "jihadijohn", "jihadjohn", "binladen",
];

/**
 * Blocked only as a whole word (a token of the name), optionally with a plain suffix
 * (-s, -es, -ed, -d, -er, -ers, -ing, -y, -ie, -ies, -z). "Ass" and "Ass_Kicker" are blocked; "Bass", "Cassidy" are not.
 * Tokens are split on underscores, digits that are not leetspeak, spaces and camelCase.
 */
export const BLOCKED_WORDS: readonly string[] = [
  // Profanity / insults
  "ass", "arse", "cock", "prick", "piss", "crap", "tit", "tits", "titty", "knob", "nob", "minge",
  "fanny", "slag", "bint", "shag", "cum", "anal", "anus", "clit", "sex", "nonce", "pedo",
  "rape", "raping", "boner", "milf", "jerkoff",
  // Slurs
  "fag", "fags", "faggy", "spaz", "spazz", "mong", "paki", "pakis", "coon", "chink", "gook",
  "kike", "spic", "spick", "wog", "wop", "yid", "taig", "negro", "sambo", "dyke", "lesbo",
  "homo", "poof", "nazi", "kkk", "gypo", "gippo",
];

/**
 * Innocent words containing a BLOCKED_SUBSTRINGS term. They are blanked out before the substring
 * check (the classic Scunthorpe problem), so "Scunthorpe" passes but "ScunthorpeCunt" does not.
 */
export const ALLOWED_SUBSTRINGS: readonly string[] = [
  "scunthorpe",
  "penistone",
  "therapist",
  "swank",
  "shitake",
];

/** Real words that look like a BLOCKED_WORDS term plus a suffix ("cocky", "sexton" …). */
export const ALLOWED_TOKENS: readonly string[] = [
  "cocky", "cocker", "cockers",
  "nobby", "nobbys", "nobbies",
  "spicy", "spicer", "spicers",
  "cumming", "cummings",
  "shaggy",
  "monger", "mongers",
  // Real surnames in the game's player data.
  "dykes", // Adam Dykes
  "fages", // Theo Fages
];
