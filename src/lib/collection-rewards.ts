/**
 * Squad Book club collections: the reward track for collecting a club's players, and the
 * club-themed title each club's 100% pays. Titles are generated here, one per club in
 * data/clubs.json, and spread into COSMETICS (lib/cosmetics.ts) as notForSale items, so they ride
 * the cosmetics store / cloud sync like the More modes unlocks and an owned title is never lost.
 * They never appear in the Store; they are equipped from the Squad Book.
 *
 * Kept free of player data (cosmetics.ts imports it on every page). The progress maths lives in
 * lib/squad-book.ts. Tests: scripts/test-squad-book-collections.ts.
 */
import clubsData from "../../data/clubs.json";
import type { CosmeticItem } from "./cosmetics";

/** Percent of a club's player pool → Club Funds (and the club title at 100%). */
export const COLLECTION_TIERS: readonly { percent: number; reward: number; title?: boolean }[] = [
  { percent: 25, reward: 100_000 },
  { percent: 50, reward: 250_000 },
  { percent: 100, reward: 1_000_000, title: true },
];

/** Clubs with fewer players than this show progress but have no reward track (too easy). */
export const COLLECTION_MIN_POOL = 10;

export const COLLECTION_TITLE_PREFIX = "title-collector-";

export const collectionSlug = (club: string) =>
  club.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Clubs that can award a title: data/clubs.json, minus the composite "Exiles" side. */
const TITLE_CLUBS: readonly { name: string; primaryColor: string; secondaryColor: string }[] = (
  clubsData as { name: string; primaryColor: string; secondaryColor: string }[]
).filter((c) => c && typeof c.name === "string" && c.name !== "Exiles");

export const collectionTitleId = (club: string) => `${COLLECTION_TITLE_PREFIX}${collectionSlug(club)}`;

export const isCollectionRewardId = (id: string | null | undefined): boolean =>
  typeof id === "string" && id.startsWith(COLLECTION_TITLE_PREFIX);

/** "Bradford Bulls Completist" — earned by collecting every player in the club's pool. */
export const COLLECTION_REWARD_COSMETICS: CosmeticItem[] = TITLE_CLUBS.map((c) => ({
  id: collectionTitleId(c.name),
  kind: "title",
  name: `${c.name} Completist`,
  blurb: `Collected every ${c.name} player in the Squad Book.`,
  price: 0,
  notForSale: true,
}));

/** The club's title id, or null when the club has none (e.g. a lower-league one-off). */
export function collectionTitleFor(club: string): string | null {
  const id = collectionTitleId(club);
  return COLLECTION_REWARD_COSMETICS.some((c) => c.id === id) ? id : null;
}

/** Club colours for the Squad Book's reward card (falls back to the theme). */
export function collectionClubColours(club: string): { primary: string; secondary: string } | null {
  const c = TITLE_CLUBS.find((x) => x.name === club);
  return c ? { primary: c.primaryColor, secondary: c.secondaryColor } : null;
}

/** Players needed for a tier: at least one, rounded up. */
export const collectionTarget = (pool: number, percent: number) =>
  Math.max(1, Math.ceil((Math.max(0, pool) * percent) / 100));
