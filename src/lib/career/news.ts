/**
 * League-relevant news. Lines about other clubs (AI deals, legend moves, other clubs' trophies)
 * are tagged with the divisions of the clubs involved when they're written; the feed then shows
 * only the user's division plus anything about the user's club. Untagged lines are the user's own.
 * Deals carry the same `divisions`. Older saves get both inferred from the clubs named.
 */
import type { CareerState, Division, TransferDeal } from "./types";

function divisionsOf(s: Pick<CareerState, "clubs">, clubIds: Array<string | null | undefined>): Division[] {
  const out: Division[] = [];
  for (const id of clubIds) {
    const d = id ? s.clubs[id]?.division : undefined;
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** Drop tags whose line has fallen off the news feed (in place). */
export function pruneNewsTags(s: CareerState): void {
  pruneTags(s);
}

function pruneTags(s: CareerState) {
  if (!s.newsTags) return;
  const live = new Set(s.news);
  for (const k of Object.keys(s.newsTags)) if (!live.has(k)) delete s.newsTags[k];
}

/**
 * Tag a news line (in place) with the divisions of the clubs it's about. A line about the user's
 * club stays untagged, so it always shows.
 */
export function tagNews(s: CareerState, line: string, clubIds: Array<string | null | undefined>): void {
  if (clubIds.includes(s.userClubId)) return;
  const divs = divisionsOf(s, clubIds);
  if (!divs.length) return;
  s.newsTags = { ...(s.newsTags ?? {}), [line]: divs };
  pruneTags(s);
}

/** Divisions a deal involves (stored when made; older deals: the clubs' divisions now). */
export function dealDivisions(s: Pick<CareerState, "clubs">, d: TransferDeal): Division[] {
  return d.divisions?.length ? d.divisions : divisionsOf(s, [d.from, d.to]);
}

/** Stamp a new deal with the divisions of its clubs. */
export function withDealDivisions<T extends TransferDeal>(s: Pick<CareerState, "clubs">, d: T): T {
  return d.divisions ? d : { ...d, divisions: divisionsOf(s, [d.from, d.to]) };
}

export function userDivision(s: Pick<CareerState, "clubs" | "userClubId">): Division {
  return s.clubs[s.userClubId]!.division;
}

/** Show this deal? Yes if it involves the user's club or a club in the user's division. */
export function isDealRelevant(s: Pick<CareerState, "clubs" | "userClubId">, d: TransferDeal): boolean {
  if (d.user || d.from === s.userClubId || d.to === s.userClubId) return true;
  const divs = dealDivisions(s, d);
  return divs.length === 0 || divs.includes(userDivision(s));
}

export function relevantDeals(s: Pick<CareerState, "clubs" | "userClubId">, deals: TransferDeal[]): TransferDeal[] {
  return deals.filter((d) => isDealRelevant(s, d));
}

/** Show this news line? Untagged = about the user (always); tagged = only if it's the user's division. */
export function isNewsRelevant(s: Pick<CareerState, "clubs" | "userClubId" | "newsTags">, line: string): boolean {
  const tag = s.newsTags?.[line];
  return !tag || tag.length === 0 || tag.includes(userDivision(s));
}

export function relevantNews(s: Pick<CareerState, "clubs" | "userClubId" | "newsTags" | "news">): string[] {
  return s.news.filter((line) => isNewsRelevant(s, line));
}

function escapeRe(x: string) {
  return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Clubs a line names (full names), for older saves' untagged lines. */
export function clubsNamed(s: Pick<CareerState, "clubs">, line: string): string[] {
  return Object.values(s.clubs)
    .filter((c) => line.includes(c.name))
    .map((c) => c.id);
}

/** Lines written about the user's own business ("Sold X to …", "Signed …", "… bid £… for your …"). */
const USER_LINE = /^(Sold |Signed |You |Your |Deadline Day: .* (bid|trump))/;

/**
 * Older saves: infer tags for the news already in the feed. A line naming the user's club (by
 * name or short code) or naming no club stays untagged; otherwise it gets the named clubs' divisions.
 */
export function inferNewsTags(s: Pick<CareerState, "clubs" | "userClubId" | "news">): Record<string, Division[]> {
  const me = s.clubs[s.userClubId]!;
  const mine = new RegExp(`(^|[^A-Za-z])(${escapeRe(me.name)}|${escapeRe(me.short)})([^A-Za-z]|$)`);
  const tags: Record<string, Division[]> = {};
  for (const line of s.news) {
    if (mine.test(line) || USER_LINE.test(line)) continue;
    const divs = divisionsOf(s, clubsNamed(s, line));
    if (divs.length) tags[line] = divs;
  }
  return tags;
}
