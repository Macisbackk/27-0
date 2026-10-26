/**
 * v1.19 side modes on /play (entries live on /modes, not the home screen):
 *   /play?oneclub=<club-slug>        One-Club XI (Era-style spins over one club's whole history)
 *   /play?gauntlet=1[&era=1]         Gauntlet after a Classic / Era Classic draft
 *   /play?archive=YYYY-MM-DD[&era=1] Past Daily, practice only
 * None of them is ranked: no leaderboards, streaks, missions, achievements or Club Funds (the
 * Gauntlet and One-Club XI keep their own personal bests in storage/mode-records.ts).
 */
export type SideMode =
  | { kind: "one-club"; club: string }
  | { kind: "gauntlet" }
  | { kind: "daily-archive"; dateKey: string };

export const MODES_PAGE = "/modes";

export function getOneClubHref(slug: string): string {
  return `/play?oneclub=${encodeURIComponent(slug)}`;
}

export function getGauntletHref(era: boolean): string {
  return era ? "/play?gauntlet=1&era=1" : "/play?gauntlet=1";
}

/** Stable key so GameBoard remounts when the side mode changes. */
export function sideModeKey(mode: SideMode | null): string {
  if (!mode) return "none";
  if (mode.kind === "one-club") return `one-club:${mode.club}`;
  if (mode.kind === "daily-archive") return `archive:${mode.dateKey}`;
  return "gauntlet";
}
