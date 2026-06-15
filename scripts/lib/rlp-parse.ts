/**
 * Shared Rugby League Project HTML parsers.
 * Used by enrichment scripts — list export + per-player summary cache.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { normalizePlayerNameKey } from "../../src/lib/player-name-normalize";

export const KNOWN_NATIONALITIES = new Set([
  "Albania",
  "Australia",
  "Cook Islands",
  "Democratic Republic of the Congo",
  "England",
  "Fiji",
  "France",
  "Ireland",
  "Italy",
  "Jamaica",
  "Lebanon",
  "Morocco",
  "New Zealand",
  "Nigeria",
  "Papua New Guinea",
  "Samoa",
  "Scotland",
  "Serbia",
  "Tonga",
  "Wales",
  "Zimbabwe",
]);

export const RLP_POS_MAP: Record<string, string> = {
  FB: "FULLBACK",
  W: "WING",
  C: "CENTRE",
  FE: "STAND_OFF",
  HB: "SCRUM_HALF",
  FR: "PROP",
  HK: "HOOKER",
  "2R": "SECOND_ROW",
  L: "LOOSE_FORWARD",
  B: "LOOSE_FORWARD",
};

export const GAME_POS_TO_LABEL: Record<string, string> = {
  FULLBACK: "Fullback",
  WING: "Wing",
  CENTRE: "Centre",
  STAND_OFF: "Stand Off",
  SCRUM_HALF: "Scrum Half",
  PROP: "Prop",
  HOOKER: "Hooker",
  SECOND_ROW: "Second Row",
  LOOSE_FORWARD: "Loose Forward",
};

export interface RlpListRow {
  rlpId: string;
  name: string;
  dob: string;
  totalApps: number;
  tries: number | null;
  primaryPosition: string | null;
}

export interface RlpSummaryData {
  nationality: string | null;
  dateOfBirth: string | null;
  birthYear: number | null;
  yearsActive: string | null;
  intlCaps: number | null;
  clubsPlayedFor: string[];
  representativeTeams: string[];
}

export function formatRlpName(rlpName: string): string {
  const m = rlpName.match(/^(.+?),\s*(.+)$/);
  if (!m) return rlpName;
  const surname = m[1]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  const first = m[2]
    .split(/[\s-]+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("-");
  return `${first} ${surname}`;
}

export function nameKey(name: string): string {
  return normalizePlayerNameKey(name);
}

function parseNum(val: string): number | null {
  if (!val || val === "-") return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function extractRowCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<td[^>]*>([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(m[1].trim());
  }
  return cells;
}

function parsePositions(raw: string): { code: string; apps: number }[] {
  return raw.split(",").map((part) => {
    const [code, appsStr] = part.trim().split("-");
    return { code: code.trim(), apps: parseInt(appsStr, 10) || 0 };
  });
}

export function pickPosition(
  positions: { code: string; apps: number }[]
): string | null {
  const playable = positions.filter((p) => RLP_POS_MAP[p.code]);
  if (playable.length === 0) return null;
  playable.sort((a, b) => b.apps - a.apps);
  return RLP_POS_MAP[playable[0].code];
}

export function buildRlpIdMap(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  if (tbodyStart < 0 || tbodyEnd < 0) return map;
  const tbody = html.slice(tbodyStart, tbodyEnd);
  const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);

  for (let i = 1; i < parts.length; i += 2) {
    const rlpId = parts[i];
    const chunk = parts[i + 1];
    const nameMatch = chunk?.match(/^([^<]+)<\/a>/);
    if (!nameMatch) continue;
    map.set(nameKey(formatRlpName(nameMatch[1])), rlpId);
  }
  return map;
}

export function parseRlpList(html: string): Map<string, RlpListRow> {
  const map = new Map<string, RlpListRow>();
  const tbodyStart = html.indexOf("<tbody>");
  const tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  if (tbodyStart < 0 || tbodyEnd < 0) return map;
  const tbody = html.slice(tbodyStart, tbodyEnd);
  const parts = tbody.split(/<tr><td><a href="\/players\/(\d+)">/);

  for (let i = 1; i < parts.length; i += 2) {
    const rlpId = parts[i];
    const chunk = parts[i + 1];
    if (!chunk) continue;

    const nameMatch = chunk.match(/^([^<]+)<\/a>([\s\S]*)$/);
    if (!nameMatch) continue;

    const cells = extractRowCells(nameMatch[2]);
    if (cells.length < 11) continue;

    const row: RlpListRow = {
      rlpId,
      name: formatRlpName(nameMatch[1]),
      dob: cells[0],
      totalApps: parseNum(cells[5]) ?? 0,
      tries: parseNum(cells[10]),
      primaryPosition: pickPosition(parsePositions(cells[2])),
    };

    map.set(nameKey(row.name), row);
  }

  return map;
}

export function nationalityFromPlaceOfBirth(place: string): string | null {
  const lower = place.toLowerCase();
  if (lower.includes("scotland")) return "Scotland";
  if (lower.includes("wales")) return "Wales";
  if (lower.includes("northern ireland")) return "Ireland";
  if (lower.includes("england")) return "England";
  if (lower.includes("ireland")) return "Ireland";
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("new zealand")) return "New Zealand";
  if (lower.includes("france")) return "France";
  if (lower.includes("samoa")) return "Samoa";
  if (lower.includes("tonga")) return "Tonga";
  if (lower.includes("fiji")) return "Fiji";
  if (lower.includes("papua")) return "Papua New Guinea";
  if (lower.includes("cook islands")) return "Cook Islands";
  if (lower.includes("lebanon")) return "Lebanon";
  if (lower.includes("jamaica")) return "Jamaica";
  if (lower.includes("italy")) return "Italy";
  if (lower.includes("serbia")) return "Serbia";
  if (lower.includes("nigeria")) return "Nigeria";
  if (lower.includes("morocco")) return "Morocco";
  if (lower.includes("albania")) return "Albania";
  if (lower.includes("zimbabwe")) return "Zimbabwe";
  if (lower.includes("democratic republic of the congo")) {
    return "Democratic Republic of the Congo";
  }

  const last = place.split(",").pop()?.trim();
  if (last && KNOWN_NATIONALITIES.has(last)) return last;
  return null;
}

export function birthYearFromDob(dob: string): number | null {
  const iso = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Number.parseInt(iso[1], 10);

  const dmy = dob.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return Number.parseInt(dmy[3], 10);

  const longForm = dob.match(/(\d{1,2})(?:st|nd|rd|th)?\s+\w+,\s+(\d{4})/i);
  if (longForm) return Number.parseInt(longForm[2], 10);

  const yearOnly = dob.match(/^(\d{4})$/);
  if (yearOnly) return Number.parseInt(yearOnly[1], 10);

  return null;
}

export function isoDateFromDob(dob: string): string | null {
  const iso = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = dob.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }

  const longForm = dob.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),\s+(\d{4})/i
  );
  if (longForm) {
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const mm = months[longForm[2].toLowerCase()];
    if (mm) {
      const dd = longForm[1].padStart(2, "0");
      return `${longForm[3]}-${mm}-${dd}`;
    }
  }

  return null;
}

export function parsePlaceOfBirth(html: string): string | null {
  const m = html.match(/<dt>Place Of Birth<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  return m?.[1]?.trim() ?? null;
}

export function parseBornField(html: string): string | null {
  const m = html.match(/<dt>Born<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  if (m) return m[1].trim();
  const legacy = html.match(/<dt>Date Of Birth<\/dt>\s*<dd>([^<]+)<\/dd>/i);
  return legacy?.[1]?.trim() ?? null;
}

export function parseCareerYears(
  html: string,
  preferPresent: boolean
): string | null {
  const marker = "English Career - By Year";
  const start = html.indexOf(marker);
  if (start < 0) return null;

  const section = html.slice(start, start + 120_000);
  const rowChunks = section.split("<tr>");
  const activeYears: number[] = [];

  for (const chunk of rowChunks) {
    const seasonMatch = chunk.match(
      /<td class="text"><a href="[^"]+">[\s\S]*?<\/a><\/td>\s*<td class="text">(\d{4})<\/td>/
    );
    if (!seasonMatch) continue;

    const afterSeason = chunk.split(
      `<td class="text">${seasonMatch[1]}</td>`
    )[1];
    const appMatch = afterSeason?.match(/<td class="n">(\d+)<\/td>/);
    const apps = appMatch ? parseInt(appMatch[1], 10) : 0;
    if (!apps || apps <= 0) continue;

    activeYears.push(parseInt(seasonMatch[1], 10));
  }

  if (activeYears.length === 0) return null;

  const min = Math.min(...activeYears);
  const max = Math.max(...activeYears);
  const isCurrent = preferPresent || max >= new Date().getFullYear() - 1;
  const end = isCurrent ? "Present" : String(max);
  return `${min}–${end}`;
}

export function parseIntlCaps(html: string): number | null {
  const m = html.match(
    /Tests \(Senior International Matches\)[\s\S]*?<td class="n">(\d+)<\/td>/
  );
  if (!m) return null;
  const caps = parseInt(m[1], 10);
  return Number.isFinite(caps) && caps > 0 ? caps : null;
}

export function parseClubsPlayedFor(html: string): string[] {
  const marker = "English Career - By Team";
  const start = html.indexOf(marker);
  if (start < 0) return [];

  const section = html.slice(start, start + 80_000);
  const clubs: string[] = [];
  const re =
    /<td class="text"><a href="\/teams\/\d+">([^<]+)<\/a><\/td>\s*<td class="text">[^<]*<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const club = m[1].trim();
    if (club && !clubs.includes(club)) clubs.push(club);
  }
  return clubs;
}

export function parseRepresentativeTeams(html: string): string[] {
  const marker = "Representative Career - International";
  const start = html.indexOf(marker);
  if (start < 0) return [];

  const section = html.slice(start, start + 60_000);
  const teams: string[] = [];
  const rowChunks = section.split("<tr>");

  for (const chunk of rowChunks) {
    const labelMatch = chunk.match(/aria-label="([^"]+)"/);
    if (!labelMatch) continue;
    const appMatch = chunk.match(/<td class="n">(\d+)<\/td>/);
    const apps = appMatch ? parseInt(appMatch[1], 10) : 0;
    if (!apps || apps <= 0) continue;
    const label = labelMatch[1].trim();
    if (label && !teams.includes(label)) teams.push(label);
  }

  return teams;
}

export function parseSummaryPage(html: string): RlpSummaryData {
  const place = parsePlaceOfBirth(html);
  const born = parseBornField(html);
  const birthYear = born ? birthYearFromDob(born) : null;
  const isoDob = born ? isoDateFromDob(born) : null;

  return {
    nationality: place ? nationalityFromPlaceOfBirth(place) : null,
    dateOfBirth: isoDob,
    birthYear,
    yearsActive: null,
    intlCaps: parseIntlCaps(html),
    clubsPlayedFor: parseClubsPlayedFor(html),
    representativeTeams: parseRepresentativeTeams(html),
  };
}

export function readCachedSummary(
  cacheDir: string,
  rlpId: string
): string | null {
  const cachePath = join(cacheDir, `${rlpId}.html`);
  if (!existsSync(cachePath)) return null;
  const html = readFileSync(cachePath, "utf-8");
  return html.includes("Place Of Birth") || html.includes("<dt>Born</dt>")
    ? html
    : null;
}

export function loadCacheByRlpId(cacheDir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(cacheDir)) return map;
  for (const file of readdirSync(cacheDir)) {
    if (!file.endsWith(".html")) continue;
    const rlpId = file.replace(".html", "");
    const html = readCachedSummary(cacheDir, rlpId);
    if (html) map.set(rlpId, html);
  }
  return map;
}
