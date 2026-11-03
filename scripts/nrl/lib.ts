/**
 * Shared helpers for the standalone NRL scripts (scripts/nrl/*.ts). Nothing under src/ uses these.
 */
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname ?? __dirname, "../..");
export const DATA = path.join(ROOT, "data/nrl");
export const CACHE = path.join(ROOT, "scripts/nrl/cache");

export const readJson = <T = any>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

/** Comment-aware reader for the pipe-separated caches: returns [headerLines, rows]. */
export function readCache(rel: string): { header: string[]; rows: string[][] } {
  const text = fs.readFileSync(path.join(CACHE, rel), "utf8");
  const header: string[] = [];
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("#")) header.push(line.slice(1).trim());
    else rows.push(line.split("|").map((s) => s.trim()));
  }
  return { header, rows };
}
export const headerValue = (header: string[], key: string) =>
  header.map((h) => h.match(new RegExp(`^${key}:\\s*(\\S+)`))?.[1]).find(Boolean) ?? null;
export const firstUrl = (header: string[]) => header.map((h) => h.match(/https?:\/\/\S+/)?.[0]).find(Boolean) ?? null;

export const normName = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(jr|snr|sr|junior)\b\.?/g, "").replace(/[^a-z]/g, "");

/** First-name variants that refer to the same person (Matt/Matthew, Nicho/Nicholas, …). */
const NICK: Record<string, string> = {
  matt: "matthew", matty: "matthew", josh: "joshua", nick: "nicholas", nicho: "nicholas", clint: "clinton",
  steve: "steven", stephen: "steven", mitch: "mitchell", tom: "thomas", tommy: "thomas", ben: "benjamin",
  sam: "samuel", joey: "joseph", steven: "steven", jamahl: "jamaal", dan: "daniel", danny: "daniel", joe: "joseph", jake: "jacob", chris: "christopher",
  pat: "patrick", will: "william", billy: "william", alex: "alexander", jack: "john", andy: "andrew",
  tony: "anthony", rob: "robert", robbie: "robert", bob: "robert", jim: "james", jimmy: "james",
  mike: "michael", dave: "david", ken: "kenneth", kenny: "kenneth", jon: "jonathan", nat: "nathan",
  greg: "gregory", benji: "benjamin", sio: "siosiua", jeff: "jeffrey", phil: "phillip", charlie: "charles",
};
export function nameKeys(name: string): string[] {
  const clean = name.replace(/\(.*?\)/g, "").replace(/\b(Jr|Jnr|Sr|Snr)\.?$/i, "").trim();
  const parts = clean.split(/\s+/);
  const keys = new Set([normName(clean)]);
  if (parts.length >= 2) {
    const first = normName(parts[0]!);
    const rest = normName(parts.slice(1).join(" "));
    keys.add((NICK[first] ?? first) + "|" + rest);
  }
  return [...keys];
}
export const surnameKey = (name: string) => normName(name.replace(/\b(Jr|Jnr|Sr|Snr)\.?$/i, "").trim().split(/\s+/).slice(1).join(" "));

/** Positions as the game codes them (src/lib/types.ts Position, abbreviated as on cards). */
export const POS_CODE: Record<string, string> = {
  fullback: "FB", wing: "WG", winger: "WG", centre: "CE", center: "CE", "five-eighth": "SO", "five eighth": "SO", fiveeighth: "SO",
  "stand-off": "SO", halfback: "SH", "scrum-half": "SH", prop: "PR", "front-row": "PR", hooker: "HK",
  "second-row": "SR", "second row": "SR", "second-rower": "SR", secondrow: "SR", lock: "LF", "loose forward": "LF", "loose-forward": "LF",
};
export const toPosCode = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const k = s.toLowerCase().replace(/^best\s+/, "").replace(/\s+of the year$/, "").trim();
  return POS_CODE[k] ?? POS_CODE[k.replace(/s$/, "")] ?? null;
};
export const POS_GAME: Record<string, string> = { FB: "FULLBACK", WG: "WING", CE: "CENTRE", SO: "STAND_OFF", SH: "SCRUM_HALF", PR: "PROP", HK: "HOOKER", SR: "SECOND_ROW", LF: "LOOSE_FORWARD" };

/** Club name (as written on Wikipedia/RLP/etc.) → data/nrl club id. */
export function clubIdFromName(name: string): string | null {
  const n = name.toLowerCase();
  const table: [RegExp, string][] = [
    [/brisbane|broncos/, "nrl-brisbane-broncos"], [/canberra|raiders/, "nrl-canberra-raiders"],
    [/canterbury|bulldogs/, "nrl-canterbury-bulldogs"], [/cronulla|sharks/, "nrl-cronulla-sharks"], [/dolphins/, "nrl-dolphins"],
    [/gold coast titans|titans/, "nrl-gold-coast-titans"], [/gold coast chargers|chargers/, "nrl-gold-coast-chargers"],
    [/northern eagles/, "nrl-northern-eagles"], [/manly|sea eagles/, "nrl-manly-sea-eagles"], [/melbourne|storm/, "nrl-melbourne-storm"],
    [/newcastle|knights/, "nrl-newcastle-knights"], [/warriors/, "nrl-new-zealand-warriors"], [/north queensland|cowboys/, "nrl-north-queensland-cowboys"],
    [/parramatta|eels/, "nrl-parramatta-eels"], [/penrith|panthers/, "nrl-penrith-panthers"], [/south sydney|rabbitohs/, "nrl-south-sydney-rabbitohs"],
    [/st\.? george illawarra/, "nrl-st-george-illawarra-dragons"], [/st\.? george/, "nrl-st-george-dragons"], [/illawarra/, "nrl-illawarra-steelers"],
    [/roosters|sydney city|eastern suburbs/, "nrl-sydney-roosters"], [/wests tigers/, "nrl-wests-tigers"], [/balmain/, "nrl-balmain-tigers"],
    [/western suburbs/, "nrl-western-suburbs-magpies"], [/north sydney/, "nrl-north-sydney-bears"], [/adelaide/, "nrl-adelaide-rams"],
  ];
  for (const [re, id] of table) if (re.test(n)) return id;
  return null;
}

export const writeLinesJson = (file: string, meta: Record<string, unknown>, key: string, arr: unknown[]) =>
  fs.writeFileSync(
    path.join(DATA, file),
    `{\n${Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n  ${JSON.stringify(key)}: [\n${arr.map((x) => "    " + JSON.stringify(x)).join(",\n")}\n  ]\n}\n`
  );

// ---------------------------------------------------------------- player resolver
export type NrlSeason = { season: number; clubId: string; clubIds?: string[]; apps: number; tries: number; goals: number; fieldGoals: number; points: number | null };
export type NrlPlayer = { id: string; name: string; seasons: NrlSeason[]; firstSeason: number; lastSeason: number; clubIds: string[]; [k: string]: any };

export function makeResolver(players: NrlPlayer[]) {
  const byKey = new Map<string, NrlPlayer[]>();
  const bySurname = new Map<string, NrlPlayer[]>();
  const add = (m: Map<string, NrlPlayer[]>, k: string, p: NrlPlayer) => { const l = m.get(k) ?? []; if (!l.includes(p)) l.push(p); m.set(k, l); };
  for (const p of players) {
    for (const k of nameKeys(p.name)) add(byKey, k, p);
    for (const a of p.aliases ?? []) for (const k of nameKeys(a)) add(byKey, k, p);
    add(bySurname, surnameKey(p.name), p);
  }
  const activeNear = (p: NrlPlayer, y: number, w: number) => p.seasons.some((s) => Math.abs(s.season - y) <= w);
  const atClub = (p: NrlPlayer, y: number, c: string) => p.seasons.some((s) => s.season === y && (s.clubIds ?? [s.clubId]).includes(c));
  /**
   * Find the database player for a name from a source. year/club narrow namesakes; a name that still
   * matches two people (or none) returns null — never a guess.
   */
  function resolve(name: string, opts: { year?: number; clubId?: string | null; window?: number; surnameOnly?: boolean; prefer?: Set<string> } = {}): NrlPlayer | null {
    const w = opts.window ?? 1;
    let cands: NrlPlayer[] = [];
    if (opts.surnameOnly) cands = bySurname.get(normName(name)) ?? [];
    else for (const k of nameKeys(name)) for (const p of byKey.get(k) ?? []) if (!cands.includes(p)) cands.push(p);
    if (opts.year !== undefined) {
      const y = opts.year;
      if (opts.clubId) { const c = cands.filter((p) => atClub(p, y, opts.clubId!)); if (c.length === 1) return c[0]!; }
      const exact = cands.filter((p) => activeNear(p, y, 0));
      const near = exact.length ? exact : cands.filter((p) => activeNear(p, y, w));
      if (near.length) cands = near;
      else if (opts.surnameOnly) return null;
    }
    if (cands.length === 1) return cands[0]!;
    if (opts.prefer && cands.length > 1) { const pr = cands.filter((p) => opts.prefer!.has(p.id)); if (pr.length === 1) return pr[0]!; }
    if (opts.surnameOnly && opts.year !== undefined && cands.length > 1) {
      // surname-only lists (Australia Test players): the busiest player that season, if clearly so
      const y = opts.year;
      const apps = (p: NrlPlayer) => p.seasons.filter((s) => Math.abs(s.season - y) <= 1).reduce((a, s) => a + s.apps, 0);
      const sorted = [...cands].sort((a, b) => apps(b) - apps(a));
      if (apps(sorted[0]!) >= 30 && apps(sorted[1]!) * 2 <= apps(sorted[0]!)) return sorted[0]!;
    }
    return null;
  }
  return { resolve, bySurname };
}
