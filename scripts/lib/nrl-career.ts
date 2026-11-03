/**
 * Manager Mode's NRL world, built from the standalone NRL database (data/nrl/).
 *
 * Writes the slim rows Manager Mode reads (src/lib/players/generated/nrl-career.runtime.json):
 * the 17 clubs of 2026 with their colours, every 2026 squad player (one club each) with a
 * position, rating, birth year and nationality, each club's records since 1998 and the premiers.
 *
 * Sources, best first:
 *   rating       nrl-ratings-2026.json (70–99 current scale)
 *   position     nrl-card-info.json positions → the squad table's position (Brisbane) → the
 *                ratings file's primary position → GAME_POSITIONS below (a game fallback, not a
 *                sourced fact) → inferred from his career try / goal rate and what the squad is short of
 *   birth year   card info date of birth / birth year / middle of the birth-year range → estimated
 *                as 20 in his first NRL season (the ratings audit's rule) → 19 for a list-only kid
 *   nationality  card info nationality → squad table nationality code → "Australia"
 *
 * Players listed at two clubs (a mid-season move) stay at the club where they played more.
 */
import { readFileSync } from "fs";
import { join } from "path";

type Pos = "FB" | "WG" | "CE" | "SO" | "SH" | "PR" | "HK" | "SR" | "LF";
const POSITIONS: Pos[] = ["FB", "WG", "CE", "SO", "SH", "PR", "HK", "SR", "LF"];
const BACKS: Pos[] = ["FB", "WG", "CE", "SO", "SH"];

/** Squad shape for 24 men; bigger squads add depth in this order. */
const TEMPLATE: Record<Pos, number> = { FB: 2, WG: 3, CE: 3, SO: 2, SH: 2, PR: 4, HK: 2, SR: 4, LF: 2 };
const EXTRA_ORDER: Pos[] = ["PR", "SR", "CE", "WG", "HK", "LF", "FB", "SH", "SO", "PR", "SR", "CE", "WG", "PR", "SR", "LF", "HK"];

const SQUAD_POS: Record<string, Pos> = {
  Fullback: "FB", Wing: "WG", Centre: "CE", "Five-eighth": "SO", Halfback: "SH",
  Prop: "PR", Hooker: "HK", "Second-row": "SR", Lock: "LF",
};
const NAT_CODE: Record<string, string> = {
  AUS: "Australia", NZL: "New Zealand", SAM: "Samoa", TON: "Tonga", FIJ: "Fiji", PNG: "Papua New Guinea",
  ENG: "England", COK: "Cook Islands", LBN: "Lebanon", SCO: "Scotland", ITA: "Italy", GRE: "Greece", WAL: "Wales", IRE: "Ireland",
};

/**
 * Game fallback positions for regulars the database has no sourced position for (their best-known
 * role up to 2025). Not a database fact: Manager Mode only, so every club can field a natural 17.
 */
export const GAME_POSITIONS: Record<string, Pos[]> = {
  "nrl-felise-kaufusi": ["SR"], "nrl-mitchell-barnett": ["PR"], "nrl-kodi-nikorima": ["SH", "HK"], "nrl-daniel-tupou": ["WG"],
  "nrl-coen-hess": ["SR"], "nrl-campbell-graham": ["CE"], "nrl-cameron-mcinnes": ["LF", "HK"], "nrl-victor-radley": ["LF"],
  "nrl-tolutau-koula": ["CE"], "nrl-sebastian-kris": ["CE"], "nrl-scott-sorensen": ["SR"], "nrl-reece-robson": ["HK"],
  "nrl-phillip-sami": ["WG", "CE"], "nrl-nathan-brown-wt": ["PR", "LF"], "nrl-kurt-mann": ["HK", "SO"], "nrl-kurt-capewell": ["SR"],
  "nrl-jeremy-marshall-king": ["HK"], "nrl-jacob-saifiti": ["PR"], "nrl-jack-bostock": ["WG", "CE"], "nrl-haumole-olakauatu": ["SR"],
  "nrl-francis-molo": ["PR"], "nrl-dane-gagai": ["CE", "WG"], "nrl-connor-watson": ["HK", "LF"], "nrl-bradman-best": ["CE"],
  "nrl-tyson-frizell": ["SR"], "nrl-trent-loiero": ["SR"], "nrl-tom-gilbert": ["LF", "PR"], "nrl-temaire-martin": ["SO", "FB"],
  "nrl-siosifa-talakai": ["CE", "SR"], "nrl-moeaki-fotuaika": ["PR"], "nrl-max-king": ["PR"], "nrl-keaon-koloamatangi": ["SR"],
  "nrl-dylan-lucas": ["SR"], "nrl-corey-horsburgh": ["PR", "LF"], "nrl-casey-mclean": ["WG"], "nrl-aj-brimson": ["FB"],
  "nrl-tevita-tatola": ["PR"], "nrl-sione-katoa-cs": ["WG"], "nrl-oregon-kaufusi": ["PR"], "nrl-marata-niukore": ["SR"],
  "nrl-jaydn-sua": ["SR"], "nrl-jack-bird": ["CE", "LF"], "nrl-euan-aitken": ["CE", "SR"], "nrl-beau-fermor": ["SR"],
  "nrl-william-kennedy-bl": ["FB"], "nrl-soni-luke": ["HK"], "nrl-siua-wong": ["SR"], "nrl-scott-drinkwater": ["FB"],
  "nrl-nick-meaney": ["FB", "CE"], "nrl-moses-suli": ["CE"], "nrl-marcelo-montoya": ["WG"], "nrl-kelma-tuilagi": ["SR"],
  "nrl-josh-king": ["PR"], "nrl-jesse-ramien": ["CE"], "nrl-isaiya-katoa": ["SH"], "nrl-chanel-harris-tavita": ["SO", "SH"],
  "nrl-brian-kelly": ["CE"], "nrl-wayde-egan": ["HK"], "nrl-sitili-tupouniua": ["SR"], "nrl-robert-toia": ["CE"],
  "nrl-reed-mahoney": ["HK"], "nrl-nat-butcher": ["SR", "LF"], "nrl-mathew-feagai": ["WG"], "nrl-luke-garner": ["SR"],
  "nrl-jayden-brailey": ["HK"], "nrl-jason-saab": ["WG"], "nrl-jack-williams": ["SR", "PR"], "nrl-enari-tuala": ["FB", "WG"],
  "nrl-demitric-vaimauga": ["PR"], "nrl-connor-tracey": ["FB", "CE"], "nrl-braydon-trindall": ["SH", "SO"], "nrl-ata-mariota": ["LF", "PR"],
  "nrl-adam-pompey": ["CE"], "nrl-xavier-savage": ["FB", "WG"], "nrl-will-penisini": ["CE"], "nrl-tyran-wishart": ["SO", "HK"],
  "nrl-tom-starling": ["HK"], "nrl-toby-rudolf": ["PR"], "nrl-teig-wilton": ["SR"], "nrl-taylan-may": ["WG", "CE"],
  "nrl-taniela-paseka": ["PR"], "nrl-sean-keppie": ["PR"], "nrl-sam-walker": ["SH"], "nrl-phoenix-crossland": ["HK"],
  "nrl-matt-lodge": ["PR"], "nrl-matt-dufty": ["FB"], "nrl-kobe-hetherington": ["LF"], "nrl-jamal-fogarty": ["SH"],
  "nrl-jake-averillo": ["CE", "SO"], "nrl-jaeman-salmon": ["SO", "LF"], "nrl-jacob-preston": ["SR"], "nrl-jacob-kiraz": ["WG"],
  "nrl-ethan-bullemor": ["SR"], "nrl-dominic-young": ["WG"], "nrl-clayton-faulalo": ["WG", "CE"], "nrl-bronson-xerri": ["CE"],
  "nrl-braidon-burns": ["WG", "CE"], "nrl-alex-twal": ["PR", "LF"], "nrl-adam-doueihi": ["SO", "FB"], "nrl-tyrell-sloan": ["FB"],
  "nrl-thomas-jenkins": ["WG"], "nrl-thomas-hazelton": ["PR"], "nrl-siosiua-taukeiaho": ["PR"], "nrl-simi-sasagi": ["SR"],
  "nrl-shawn-blore": ["SR"], "nrl-sean-russell": ["FB", "CE"], "nrl-sam-mcintyre": ["SR", "LF"], "nrl-ray-stone": ["LF", "PR"],
  "nrl-paul-alamoti": ["CE"], "nrl-mat-croker": ["PR"], "nrl-lindsay-smith": ["PR"], "nrl-kyle-flanagan": ["SH"],
  "nrl-kulikefu-finefeuiaki": ["SR"], "nrl-kaeo-weekes": ["FB"], "nrl-josh-kerr": ["PR"], "nrl-jayden-campbell": ["FB", "SO"],
  "nrl-jake-simpkin": ["HK"], "nrl-jacob-liddle": ["HK"], "nrl-jackson-ford": ["PR"], "nrl-jack-cogger": ["SO", "SH"],
  "nrl-emre-guler": ["PR"], "nrl-egan-butcher": ["SR"], "nrl-daine-laurie-pn": ["FB"], "nrl-bunty-afoa": ["PR"],
  "nrl-billy-smith-es": ["CE"], "nrl-billy-burns": ["SR"], "nrl-ben-trbojevic": ["LF", "SR"], "nrl-alofiana-khan-pereira": ["WG"],
  "nrl-alec-macdonald": ["PR"], "nrl-zac-hosking": ["SR"], "nrl-tanah-boyd": ["SH"], "nrl-tallis-duncan": ["SR", "LF"],
  "nrl-starford-toa": ["WG"], "nrl-sam-verrills": ["HK"], "nrl-patrick-herbert": ["CE"], "nrl-mitch-kenny": ["HK"],
  "nrl-max-plath": ["LF", "HK"], "nrl-klese-haas": ["PR"], "nrl-josh-curran": ["LF", "SR"], "nrl-jojo-fifita": ["WG"],
  "nrl-jayden-sullivan": ["SH", "HK"], "nrl-harrison-edwards": ["PR"], "nrl-freddy-lussick": ["HK"], "nrl-fonua-pole": ["PR"],
  "nrl-corey-waddell": ["SR"], "nrl-cody-ramsey": ["FB", "WG"], "nrl-chris-randall": ["LF", "HK"], "nrl-blake-lawrie": ["PR"],
  "nrl-blaize-talagi": ["SO", "CE"], "nrl-bailey-hayward": ["HK"], "nrl-ativalu-lisati": ["SR"], "nrl-alex-seyfarth": ["SR", "LF"],
  "nrl-tom-chester": ["CE"], "nrl-mawene-hiroti": ["WG", "CE"], "nrl-matt-eisenhuth": ["PR"], "nrl-liam-henry": ["PR", "LF"],
  "nrl-lehi-hopoate": ["WG"], "nrl-kayal-iro": ["CE"], "nrl-jaxon-purdue": ["CE", "WG"], "nrl-jack-hetherington": ["PR"],
  "nrl-fletcher-sharpe": ["FB", "CE"], "nrl-corey-harawira-naera": ["SR"], "nrl-christian-tuipulotu": ["CE", "WG"],
  "nrl-toby-couchman": ["SR", "LF"], "nrl-samuel-hughes": ["SR"], "nrl-peter-mamouzelos": ["HK"], "nrl-leka-halasima": ["SR"],
  "nrl-lachlan-croker": ["LF", "HK"], "nrl-jock-madden": ["SH"], "nrl-jeral-skelton": ["WG"], "nrl-hugo-savala": ["SO", "SH"],
  "nrl-daniel-suluka-fifita": ["PR"], "nrl-adam-elliott": ["SR"], "nrl-oryn-keeley": ["SR"], "nrl-lachlan-ilias": ["SH"],
  "nrl-jamie-humphreys": ["SH"], "nrl-drew-hutchison": ["SO"], "nrl-lachlan-galvin": ["SH", "SO"], "nrl-latu-fainu": ["SH", "HK"],
  "nrl-luke-metcalf": ["SH", "SO"], "nrl-isaiah-iongi": ["FB"], "nrl-edward-kosi": ["WG"], "nrl-jake-turpin": ["HK"],
  "nrl-jonah-pezet": ["SO", "SH"], "nrl-moses-leo": ["WG"], "nrl-ethan-sanders": ["SH", "SO"], "nrl-sean-osullivan": ["SH"],
  "nrl-jethro-rinakama": ["WG"], "nrl-chevy-stewart": ["FB"],
};

type Raw = Record<string, any>;
export interface NrlCareerClub {
  id: string;
  name: string;
  short: string;
  nickname: string;
  primary: string;
  secondary: string;
  accent?: string;
}
export interface NrlCareerPlayer {
  id: string;
  name: string;
  club: string;
  pos: Pos;
  alt?: Pos[];
  rating: number;
  birthYear: number;
  nationality: string;
}
export interface NrlClubRecord {
  name: string;
  value: number;
  years: string;
}
export interface NrlCareerData {
  clubs: NrlCareerClub[];
  players: NrlCareerPlayer[];
  /** Club records in the NRL era (1998–2026). */
  records: Record<string, Partial<Record<"tries" | "goals" | "points" | "apps", NrlClubRecord>>>;
  /** NRL premiers and minor premiers by season. */
  premiers: Record<string, string>;
  minorPremiers: Record<string, string>;
}

const SEASON = 2026;
/** Short codes that would clash with a Championship club (Newcastle Thunder is NEW). */
const SHORT_OVERRIDE: Record<string, string> = { "nrl-newcastle-knights": "KNI" };

const normName = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(jr|jnr|snr|sr|junior)\b\.?/g, "").replace(/[^a-z]/g, "");
const slug = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

function desiredCounts(n: number): Record<Pos, number> {
  const out = { ...TEMPLATE };
  let total = 24;
  let i = 0;
  while (total < n) {
    out[EXTRA_ORDER[i++ % EXTRA_ORDER.length]!]++;
    total++;
  }
  return out;
}

export function buildNrlCareerData(root: string): NrlCareerData {
  const read = (f: string): Raw => JSON.parse(readFileSync(join(root, "data", f), "utf8"));
  const clubsDb = read("nrl/nrl-clubs.json").clubs as Raw[];
  const scaffold = new Map((read("nrl-clubs.json") as unknown as Raw[]).map((c) => [c.id, c]));
  const squads = read("nrl/nrl-current-squads-2026.json").clubs as Raw[];
  const ratings = read("nrl/nrl-ratings-2026.json").players as Raw[];
  const cardInfo = new Map((read("nrl/nrl-card-info.json").players as Raw[]).map((p) => [p.id, p]));
  const people = read("nrl/nrl-players.json").players as Raw[];
  const byPerson = new Map(people.map((p) => [p.id, p]));
  const gfs = read("nrl/nrl-grand-finals.json").grandFinals as Raw[];
  const ladders = read("nrl/nrl-ladders.json").seasons as Record<string, Raw>;

  const active = clubsDb.filter((c) => c.status === "active" && (c.nrlSeasonsInDb ?? [])[1] === SEASON);
  const clubs: NrlCareerClub[] = active.map((c) => {
    const s = scaffold.get(c.id) ?? {};
    return {
      id: c.id,
      name: c.name,
      short: SHORT_OVERRIDE[c.id] ?? c.shortName,
      nickname: c.nickname,
      primary: c.primaryColor ?? s.primaryColor ?? "#1f2937",
      secondary: c.secondaryColor ?? s.secondaryColor ?? "#ffffff",
      ...(s.accentColor ? { accent: s.accentColor } : {}),
    };
  });
  const clubIds = new Set(clubs.map((c) => c.id));

  const ratingOf = (id: string | null, name: string, clubId: string): Raw | undefined =>
    ratings.find((r) => (id ? r.playerId === id : !r.playerId && r.name === name && r.clubId === clubId));

  // One entry per player: the club where he played more this season.
  type Entry = { id: string; dbId: string | null; name: string; club: string; row: Raw; rating: number; apps: number };
  const entries = new Map<string, Entry>();
  for (const squad of squads) {
    if (!clubIds.has(squad.clubId)) continue;
    for (const row of squad.players as Raw[]) {
      const dbId = (row.playerId as string | null) ?? null;
      const r = ratingOf(dbId, row.name, squad.clubId);
      if (!r) continue;
      const id = dbId ?? `nrl-sq-${slug(row.name)}`;
      const e: Entry = { id, dbId, name: cardInfo.get(dbId ?? "")?.name ?? row.name, club: squad.clubId, row, rating: r.rating, apps: row.apps2026 ?? 0 };
      const prev = entries.get(id);
      if (!prev || e.apps > prev.apps || (e.apps === prev.apps && e.club < prev.club)) entries.set(id, e);
    }
  }
  // List-only names that are a near-spelling of a player already at the club (Bassingthwaite / -ghte).
  for (const e of [...entries.values()]) {
    if (e.dbId) continue;
    const n = normName(e.name);
    const twin = [...entries.values()].find((o) => o !== e && o.club === e.club && lev(normName(o.name), n) <= 2);
    if (twin) entries.delete(e.id);
  }

  const posFor = (e: Entry): Pos[] | null => {
    const ci = e.dbId ? cardInfo.get(e.dbId) : undefined;
    const fromCard = (ci?.positions as string[] | null)?.filter((p): p is Pos => POSITIONS.includes(p as Pos));
    if (fromCard?.length) return [...new Set(fromCard)];
    if (e.row.position && SQUAD_POS[e.row.position]) return [SQUAD_POS[e.row.position]!];
    const r = ratingOf(e.dbId, e.row.name, e.row.clubId ?? e.club);
    if (r?.primaryPosition && POSITIONS.includes(r.primaryPosition)) return [r.primaryPosition];
    if (GAME_POSITIONS[e.id]) return GAME_POSITIONS[e.id]!;
    return null;
  };

  const birthYearFor = (e: Entry): number => {
    const ci = e.dbId ? cardInfo.get(e.dbId) : undefined;
    if (ci?.dateOfBirth) return Number(String(ci.dateOfBirth).slice(0, 4));
    if (ci?.birthYear) return ci.birthYear;
    if (Array.isArray(ci?.birthYearRange)) return Math.round((ci!.birthYearRange[0] + ci!.birthYearRange[1]) / 2);
    const debut = ci?.nrlDebutYear ?? e.row.nrlDebutSeason ?? (e.row.clubDebut ? Number(e.row.clubDebut) : null);
    if (debut && debut >= 1999) return debut - 20;
    return SEASON - 19;
  };

  const nationalityFor = (e: Entry): string => {
    const ci = e.dbId ? cardInfo.get(e.dbId) : undefined;
    if (ci?.nationality) return ci.nationality === "Great Britain" ? "England" : ci.nationality;
    if (e.row.nationalityCode && NAT_CODE[e.row.nationalityCode]) return NAT_CODE[e.row.nationalityCode]!;
    return "Australia";
  };

  /** Career try and goal rates (1998+), for the inference fallback. */
  const rates = (e: Entry): { tries: number; goals: number; apps: number } => {
    const p = e.dbId ? byPerson.get(e.dbId) : undefined;
    const t = p?.nrlTotals1998on;
    if (t && t.apps > 0) return { tries: t.tries / t.apps, goals: t.goals / t.apps, apps: t.apps };
    return { tries: 0, goals: 0, apps: 0 };
  };

  const players: NrlCareerPlayer[] = [];
  for (const club of clubs) {
    const list = [...entries.values()].filter((e) => e.club === club.id).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
    const want = desiredCounts(list.length);
    const counts: Record<Pos, number> = { FB: 0, WG: 0, CE: 0, SO: 0, SH: 0, PR: 0, HK: 0, SR: 0, LF: 0 };
    const known = new Map<string, Pos[]>();
    for (const e of list) {
      const p = posFor(e);
      if (!p) continue;
      known.set(e.id, p);
      counts[p[0]!]++;
    }
    const deficit = (p: Pos) => want[p] - counts[p];
    const unknown = list.filter((e) => !known.has(e.id));
    const take = (e: Entry, order: Pos[]) => {
      const pos = [...order].sort((a, b) => deficit(b) - deficit(a) || order.indexOf(a) - order.indexOf(b))[0]!;
      known.set(e.id, [pos]);
      counts[pos]++;
    };
    // Goal-kickers with no position: the halves or the back three.
    for (const e of unknown) {
      const r = rates(e);
      if (r.apps >= 5 && r.goals >= 1 && ["SH", "SO", "FB"].some((p) => deficit(p as Pos) > 0)) take(e, ["SH", "SO", "FB"]);
    }
    const rest = unknown.filter((e) => !known.has(e.id));
    const withStats = rest.filter((e) => rates(e).apps >= 5).sort((a, b) => rates(b).tries - rates(a).tries || a.id.localeCompare(b.id));
    const backSlots = Math.max(0, BACKS.reduce((t, p) => t + Math.max(0, deficit(p)), 0));
    withStats.forEach((e, i) => {
      // Try-scorers are backs (wingers first), the rest forwards (back-rowers score more than props).
      const back = i < backSlots && rates(e).tries >= 0.2;
      take(e, back ? ["WG", "CE", "FB", "SO", "SH"] : ["SR", "LF", "HK", "PR"]);
    });
    for (const e of rest.filter((x) => !known.has(x.id))) {
      take(e, ["PR", "SR", "CE", "WG", "HK", "FB", "SH", "SO", "LF"]);
    }
    for (const e of list) {
      const pos = known.get(e.id)!;
      const alt = pos.slice(1).filter((p) => p !== pos[0]);
      players.push({
        id: e.id,
        name: e.name,
        club: club.id,
        pos: pos[0]!,
        ...(alt.length ? { alt } : {}),
        rating: e.rating,
        birthYear: birthYearFor(e),
        nationality: nationalityFor(e),
      });
    }
  }

  // Club records 1998–2026 from the season rows (single-club seasons only).
  const records: NrlCareerData["records"] = {};
  for (const id of clubIds) records[id] = {};
  const totals = new Map<string, { name: string; club: string; apps: number; tries: number; goals: number; points: number; first: number; last: number }>();
  for (const p of people) {
    for (const s of p.seasons as Raw[]) {
      if (!s.clubId || !clubIds.has(s.clubId)) continue;
      const k = `${p.id}|${s.clubId}`;
      const t = totals.get(k) ?? { name: p.name, club: s.clubId, apps: 0, tries: 0, goals: 0, points: 0, first: s.season, last: s.season };
      t.apps += s.apps ?? 0;
      t.tries += s.tries ?? 0;
      t.goals += s.goals ?? 0;
      t.points += s.points ?? (s.tries ?? 0) * 4 + (s.goals ?? 0) * 2 + (s.fieldGoals ?? 0);
      t.first = Math.min(t.first, s.season);
      t.last = Math.max(t.last, s.season);
      totals.set(k, t);
    }
  }
  for (const t of totals.values()) {
    const rec = records[t.club]!;
    for (const kind of ["tries", "goals", "points", "apps"] as const) {
      const v = t[kind];
      if (v > 0 && (!rec[kind] || v > rec[kind]!.value)) rec[kind] = { name: t.name, value: v, years: t.first === t.last ? `${t.first}` : `${t.first}–${t.last}` };
    }
  }

  const premiers: Record<string, string> = {};
  for (const g of gfs) if (g.premiersClubId && !g.stripped) premiers[String(g.season)] = g.premiersClubId;
  const minorPremiers: Record<string, string> = {};
  for (const [year, l] of Object.entries(ladders)) {
    const top = (l.table as Raw[] | undefined)?.find((r) => r.position === 1);
    if (top?.clubId) minorPremiers[year] = top.clubId;
  }

  return { clubs, players, records, premiers, minorPremiers };
}

/** One record per line, so diffs stay readable. */
export function formatNrlCareerData(d: NrlCareerData): string {
  const lines = (rows: unknown[]) => rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return [
    "{",
    `  "clubs": [\n${lines(d.clubs)}\n  ],`,
    `  "players": [\n${lines(d.players)}\n  ],`,
    `  "records": ${JSON.stringify(d.records)},`,
    `  "premiers": ${JSON.stringify(d.premiers)},`,
    `  "minorPremiers": ${JSON.stringify(d.minorPremiers)}`,
    "}",
    "",
  ].join("\n");
}
