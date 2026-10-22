/**
 * Reads the cached Wikipedia player articles (scripts/wikipedia-cache/*.json) for the quiz
 * generator: career clubs and international teams from the rugby league infobox, plus the
 * full article text so wrong answers can be limited to clubs / nations the article never mentions.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { QuizTeamId } from "../../src/lib/quiz/types";

export interface WikiClubSpell {
  /** Quiz display name, e.g. "Hull KR". */
  club: string;
  teamId: QuizTeamId;
  appearances: number;
  startYear: number;
  loan: boolean;
}

export interface WikiPlayer {
  title: string;
  wikitext: string;
  /** Super League clubs from the infobox (non-Super League clubs are dropped). */
  spells: WikiClubSpell[];
  /** International sides from the infobox (teamA..teamD), as nation names. */
  nations: string[];
}

/** Quiz club name, quiz id, Wikipedia link targets, and a pattern that finds any mention. */
export const WIKI_SL_CLUBS: {
  name: string;
  teamId: QuizTeamId;
  targets: string[];
  mention: RegExp;
}[] = [
  { name: "Wigan", teamId: "wigan", targets: ["Wigan Warriors", "Wigan"], mention: /wigan/i },
  { name: "Leeds", teamId: "leeds", targets: ["Leeds Rhinos", "Leeds"], mention: /leeds/i },
  {
    name: "St Helens",
    teamId: "st-helens",
    targets: ["St Helens R.F.C.", "St. Helens R.F.C.", "St Helens", "St Helens RFC"],
    mention: /st\.? helens|saints/i,
  },
  { name: "Warrington", teamId: "warrington", targets: ["Warrington Wolves", "Warrington"], mention: /warrington/i },
  // Any mention of Hull rules out both Hull clubs as wrong answers.
  { name: "Hull FC", teamId: "hull-fc", targets: ["Hull F.C.", "Hull FC"], mention: /hull/i },
  { name: "Hull KR", teamId: "hull-kr", targets: ["Hull Kingston Rovers", "Hull KR"], mention: /hull/i },
  { name: "Castleford", teamId: "castleford", targets: ["Castleford Tigers", "Castleford"], mention: /castleford/i },
  {
    name: "Wakefield Trinity",
    teamId: "wakefield",
    targets: ["Wakefield Trinity", "Wakefield Trinity Wildcats"],
    mention: /wakefield/i,
  },
  { name: "Huddersfield", teamId: "huddersfield", targets: ["Huddersfield Giants", "Huddersfield"], mention: /huddersfield/i },
  { name: "Bradford", teamId: "bradford", targets: ["Bradford Bulls", "Bradford Northern"], mention: /bradford/i },
  { name: "Catalans Dragons", teamId: "catalans", targets: ["Catalans Dragons"], mention: /catalan|perpignan/i },
  {
    name: "Salford",
    teamId: "salford",
    targets: ["Salford Red Devils", "Salford City Reds", "Salford"],
    mention: /salford/i,
  },
  {
    name: "Leigh",
    teamId: "leigh",
    targets: ["Leigh Leopards", "Leigh Centurions", "Leigh"],
    mention: /\bleigh\b/i,
  },
  { name: "London Broncos", teamId: "london", targets: ["London Broncos"], mention: /london|harlequin/i },
  { name: "Widnes", teamId: "widnes", targets: ["Widnes Vikings", "Widnes"], mention: /widnes/i },
  { name: "Toulouse Olympique", teamId: "toulouse", targets: ["Toulouse Olympique"], mention: /toulouse/i },
];

/** Nations used for international questions, with a pattern that finds any mention. */
export const WIKI_NATIONS: { name: string; mention: RegExp; group: "europe" | "pacific" | "other" }[] = [
  { name: "England", mention: /england|english/i, group: "europe" },
  { name: "Scotland", mention: /scotland|scottish/i, group: "europe" },
  { name: "Wales", mention: /wales|welsh/i, group: "europe" },
  { name: "Ireland", mention: /ireland|irish/i, group: "europe" },
  { name: "France", mention: /france|french/i, group: "europe" },
  { name: "Italy", mention: /italy|italian/i, group: "europe" },
  { name: "Jamaica", mention: /jamaica/i, group: "other" },
  { name: "Lebanon", mention: /leban/i, group: "other" },
  { name: "Greece", mention: /greece|greek/i, group: "other" },
  { name: "Malta", mention: /malt/i, group: "other" },
  { name: "Serbia", mention: /serbia/i, group: "other" },
  { name: "Samoa", mention: /samoa/i, group: "pacific" },
  { name: "Tonga", mention: /tonga/i, group: "pacific" },
  { name: "Fiji", mention: /fiji/i, group: "pacific" },
  { name: "Papua New Guinea", mention: /papua|png\b|kumul/i, group: "pacific" },
  { name: "Cook Islands", mention: /cook island/i, group: "pacific" },
  { name: "New Zealand", mention: /new zealand|kiwi/i, group: "pacific" },
  { name: "Australia", mention: /australia/i, group: "pacific" },
];

function extractInfobox(wikitext: string): string | null {
  const start = wikitext.toLowerCase().indexOf("{{infobox rugby league biography");
  if (start < 0) return null;
  let depth = 0;
  for (let index = start; index < wikitext.length; index += 1) {
    if (wikitext.startsWith("{{", index)) {
      depth += 1;
      index += 1;
    } else if (wikitext.startsWith("}}", index)) {
      depth -= 1;
      index += 1;
      if (depth === 0) return wikitext.slice(start, index + 1);
    }
  }
  return null;
}

function infoboxFields(box: string): Map<string, string> {
  const body = box.slice(2, -2);
  const parts: string[] = [];
  let depth = 0;
  let buffer = "";
  for (let index = 0; index < body.length; index += 1) {
    const pair = body.slice(index, index + 2);
    if (pair === "{{" || pair === "[[") {
      depth += 1;
      buffer += pair;
      index += 1;
      continue;
    }
    if (pair === "}}" || pair === "]]") {
      depth -= 1;
      buffer += pair;
      index += 1;
      continue;
    }
    if (body[index] === "|" && depth === 0) {
      parts.push(buffer);
      buffer = "";
      continue;
    }
    buffer += body[index];
  }
  parts.push(buffer);
  const fields = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    fields.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return fields;
}

function linkTarget(value: string): string | null {
  const match = /\[\[([^\]|]+)/.exec(value);
  return match ? match[1]!.trim() : null;
}

function leadingInt(value: string | undefined): number {
  const match = /^\s*(\d+)/.exec(value ?? "");
  return match ? Number(match[1]) : 0;
}

const TARGET_TO_CLUB = new Map<string, (typeof WIKI_SL_CLUBS)[number]>();
for (const club of WIKI_SL_CLUBS) {
  for (const target of club.targets) TARGET_TO_CLUB.set(target.toLowerCase(), club);
}

const NATION_TARGET = /^(.+?) national rugby league team$/i;

export function loadWikiPlayers(root: string): WikiPlayer[] {
  const dir = join(root, "scripts/wikipedia-cache");
  const players: WikiPlayer[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      title?: string;
      wikitext?: string;
    };
    if (!raw.title || !raw.wikitext) continue;
    const box = extractInfobox(raw.wikitext);
    if (!box) continue;
    const fields = infoboxFields(box);
    const spells: WikiClubSpell[] = [];
    for (const [key, value] of fields) {
      const match = /^club(\d+)$/.exec(key);
      if (!match) continue;
      const n = match[1];
      const startRaw = fields.get(`year${n}start`) ?? "";
      const endRaw = fields.get(`year${n}end`) ?? "";
      const loan =
        value.includes("→") ||
        /loan|dual/i.test(`${value} ${startRaw} ${endRaw}`);
      const target = linkTarget(value);
      const club = target ? TARGET_TO_CLUB.get(target.toLowerCase()) : undefined;
      if (!club) continue;
      spells.push({
        club: club.name,
        teamId: club.teamId,
        appearances: leadingInt(fields.get(`appearances${n}`)),
        startYear: leadingInt(startRaw),
        loan,
      });
    }
    const nations: string[] = [];
    for (const [key, value] of fields) {
      if (!/^team[A-Z]$/.test(key)) continue;
      const target = linkTarget(value);
      const match = target ? NATION_TARGET.exec(target) : null;
      if (match) nations.push(match[1]!.trim());
    }
    players.push({ title: raw.title, wikitext: raw.wikitext, spells, nations });
  }
  return players;
}
