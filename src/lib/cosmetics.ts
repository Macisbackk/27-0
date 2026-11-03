/**
 * Store cosmetics bought with Club Funds. Nothing here changes ratings or results —
 * Ball Knower mode is harder, not easier.
 */
import type { ClubKit, KitPattern } from "./club-kits";
import { COLLECTION_REWARD_COSMETICS, isCollectionRewardId } from "./collection-rewards";

export type CosmeticKind = "kit" | "pitch" | "title" | "frame" | "mode";

/**
 * "starter": the cheap first rung (£50k–£300k) a new player can reach on day one from the starter
 * grant and the dailies (v1.46: prices ×3; v1.66 Store economy pass: see docs/store-economy.md).
 */
export type CosmeticTier = "starter";

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  price: number;
  tier?: CosmeticTier;
  /** Earned in the game, never sold (the More modes unlocks: Ball Knower v1.47, the rest v1.50; achievement kits v1.66). */
  notForSale?: boolean;
}

export const KIT_DESIGNER_ID = "kit-designer";
export const BALL_KNOWER_ID = "mode-ball-knower";
/** More modes, each earned by a challenge (v1.50, lib/mode-unlocks.ts). */
export const ONE_CLUB_MODE_ID = "mode-one-club";
export const GAUNTLET_MODE_ID = "mode-gauntlet";
export const PAST_DAILIES_MODE_ID = "mode-past-dailies";
/** Thin white border, given free with the login welcome bonus (see storage/login-welcome.ts). */
export const CHALK_FRAME_ID = "frame-chalk";

/** Achievement kits: never sold, earned by a feat (lib/achievement-kits.ts). */
export const KIT_PERFECT_ID = "kit-invincibles";
export const KIT_29_0_ID = "kit-29-0";
export const KIT_STREAK_30_ID = "kit-streak-30";
export const KIT_STREAK_100_ID = "kit-centurion";
export const KIT_MANAGER_GF_ID = "kit-old-trafford";

/*
 * Prices (v1.66 economy pass, docs/store-economy.md): a typical regular player (the dailies, the
 * Daily Challenge and two Classic runs) earns about £1.1m a day; a dailies-only player about
 * £115k. Everything under £10m came down by a third, so the ladder runs: Starter £50k–£300k (day
 * one), cheap £300k–£900k, mid £1m–£2.5m (a regular's every-day-or-two buy), premium £3m–£6m (a
 * few days), top £12m–£30m (two to four weeks for a regular). Owned items are never taken away:
 * ownership is by id, so a price change only affects what is still to buy.
 */
export const COSMETICS: CosmeticItem[] = [
  { id: KIT_DESIGNER_ID, kind: "kit", name: "Kit designer", blurb: "Your own shirt on your Classic team.", price: 3_000_000 },
  // Ready-made kits (v1.66): the cheap way into a new shirt.
  { id: "kit-training-bib", kind: "kit", name: "Training bib", blurb: "Hi-vis orange, straight from the cone drills.", price: 75_000, tier: "starter" },
  { id: "kit-blue-hoops", kind: "kit", name: "Navy hoops", blurb: "Navy and white hoops. Timeless.", price: 150_000, tier: "starter" },
  { id: "kit-retro-v", kind: "kit", name: "Retro V", blurb: "Cream with a claret V, 1970s style.", price: 300_000, tier: "starter" },
  { id: "kit-away-teal", kind: "kit", name: "Away strip", blurb: "Teal with a white band for the long trips.", price: 600_000 },
  { id: "kit-heritage-stripes", kind: "kit", name: "Heritage stripes", blurb: "Bottle green and gold stripes.", price: 1_000_000 },
  // Earned, never sold (lib/achievement-kits.ts).
  { id: KIT_PERFECT_ID, kind: "kit", name: "Invincibles kit", blurb: "Black and gold. Only for coaches who went 27-0.", price: 0, notForSale: true },
  { id: KIT_29_0_ID, kind: "kit", name: "29-0 kit", blurb: "White with a gold band: the perfect season and the play-offs.", price: 0, notForSale: true },
  { id: KIT_STREAK_30_ID, kind: "kit", name: "Month of Dailies", blurb: "Sky and navy hoops for 30 Dailies in a row.", price: 0, notForSale: true },
  { id: KIT_STREAK_100_ID, kind: "kit", name: "Centurion kit", blurb: "Claret with a gold stripe for a 100-day streak.", price: 0, notForSale: true },
  { id: KIT_MANAGER_GF_ID, kind: "kit", name: "Old Trafford kit", blurb: "Navy, red and white for a Manager Mode Grand Final win.", price: 0, notForSale: true },

  // Starter rung: within reach on day one.
  { id: "pitch-park", kind: "pitch", name: "Park pitch", blurb: "Patchy Sunday-league grass.", price: 50_000, tier: "starter" },
  { id: "pitch-overcast", kind: "pitch", name: "Overcast", blurb: "Flat grey light, rain on the way.", price: 100_000, tier: "starter" },
  { id: "pitch-training", kind: "pitch", name: "Training ground", blurb: "Fresh-cut training grass.", price: 150_000, tier: "starter" },
  { id: "pitch-dusk", kind: "pitch", name: "Dusk", blurb: "Evening light before kick-off.", price: 200_000, tier: "starter" },
  { id: "pitch-astro", kind: "pitch", name: "Astro", blurb: "Bright artificial turf, perfect stripes.", price: 300_000, tier: "starter" },
  { id: "pitch-floodlit", kind: "pitch", name: "Floodlit night", blurb: "Big-match lights over a dark pitch.", price: 1_500_000 },
  { id: "pitch-winter", kind: "pitch", name: "Winter mud", blurb: "A churned-up February pitch.", price: 1_500_000 },
  { id: "pitch-snow", kind: "pitch", name: "Snow game", blurb: "Lines cleared, snow on the touchline.", price: 1_500_000 },
  { id: "pitch-retro", kind: "pitch", name: "Retro", blurb: "Faded grass and chalk lines, 1990s style.", price: 1_500_000 },
  { id: "pitch-summer", kind: "pitch", name: "Summer sun", blurb: "Bright grass on a July afternoon.", price: 500_000 },
  { id: "pitch-rain", kind: "pitch", name: "Rain-soaked", blurb: "Dark, wet grass after a downpour.", price: 800_000 },
  { id: "pitch-checker", kind: "pitch", name: "Checkerboard", blurb: "Mowed in squares by a proud groundsman.", price: 1_000_000 },
  { id: "pitch-wide-stripes", kind: "pitch", name: "Wide stripes", blurb: "Big bold mowing stripes.", price: 1_000_000 },
  { id: "pitch-autumn", kind: "pitch", name: "Autumn", blurb: "Leaves blowing across the in-goal.", price: 1_200_000 },
  { id: "pitch-frost", kind: "pitch", name: "Frosty morning", blurb: "A white frost still on the grass.", price: 1_500_000 },
  { id: "pitch-sunset", kind: "pitch", name: "Sunset", blurb: "Orange sky over the far stand.", price: 1_800_000 },
  { id: "pitch-heritage", kind: "pitch", name: "Heritage", blurb: "Sepia tones, like an old match photo.", price: 2_000_000 },
  { id: "pitch-midnight", kind: "pitch", name: "Midnight", blurb: "Deep blue night, lines glowing.", price: 2_500_000 },
  { id: "pitch-neon", kind: "pitch", name: "Neon", blurb: "Glowing lines on a black pitch.", price: 4_000_000 },
  { id: "pitch-grand-final", kind: "pitch", name: "Grand Final", blurb: "Gold lines for the biggest night.", price: 6_000_000 },

  { id: "title-mascot", kind: "title", name: "Club Mascot", blurb: "Shown next to your name.", price: 50_000, tier: "starter" },
  { id: "title-touch-judge", kind: "title", name: "Touch Judge", blurb: "Shown next to your name.", price: 75_000, tier: "starter" },
  { id: "title-rookie", kind: "title", name: "Rookie", blurb: "Shown next to your name.", price: 100_000, tier: "starter" },
  { id: "title-ball-boy", kind: "title", name: "Ball Boy", blurb: "Shown next to your name.", price: 100_000, tier: "starter" },
  { id: "title-terrace-regular", kind: "title", name: "Terrace Regular", blurb: "Shown next to your name.", price: 100_000, tier: "starter" },
  { id: "title-sin-bin", kind: "title", name: "Sin Bin Regular", blurb: "Shown next to your name.", price: 150_000, tier: "starter" },
  { id: "title-ball-knower", kind: "title", name: "Ball Knower", blurb: "Shown next to your name.", price: 1_000_000 },
  { id: "title-spin-doctor", kind: "title", name: "Spin Doctor", blurb: "Shown next to your name.", price: 1_000_000 },
  { id: "title-deadline-dealer", kind: "title", name: "Deadline Day Dealer", blurb: "Shown next to your name.", price: 2_000_000 },
  { id: "title-golden-point", kind: "title", name: "Golden Point Merchant", blurb: "Shown next to your name.", price: 2_000_000 },
  { id: "title-academy-guru", kind: "title", name: "Academy Guru", blurb: "Shown next to your name.", price: 2_000_000 },
  { id: "title-gf-gaffer", kind: "title", name: "Grand Final Gaffer", blurb: "Shown next to your name.", price: 4_000_000 },
  { id: "title-invincible", kind: "title", name: "The Invincible", blurb: "Shown next to your name.", price: 15_000_000 },
  { id: "title-water-carrier", kind: "title", name: "Water Carrier", blurb: "Shown next to your name.", price: 150_000, tier: "starter" },
  { id: "title-season-ticket", kind: "title", name: "Season Ticket Holder", blurb: "Shown next to your name.", price: 200_000, tier: "starter" },
  { id: "title-kit-man", kind: "title", name: "Kit Man", blurb: "Shown next to your name.", price: 300_000, tier: "starter" },
  { id: "title-scout", kind: "title", name: "Scout", blurb: "Shown next to your name.", price: 500_000 },
  { id: "title-tactician", kind: "title", name: "Tactician", blurb: "Shown next to your name.", price: 800_000 },
  { id: "title-set-completer", kind: "title", name: "Set Completer", blurb: "Shown next to your name.", price: 800_000 },
  { id: "title-forward-pass", kind: "title", name: "Forward Pass Truther", blurb: "Shown next to your name.", price: 1_200_000 },
  { id: "title-big-hitter", kind: "title", name: "Big Hitter", blurb: "Shown next to your name.", price: 1_500_000 },
  { id: "title-try-machine", kind: "title", name: "Try Machine", blurb: "Shown next to your name.", price: 1_500_000 },
  { id: "title-drop-goal", kind: "title", name: "Drop Goal Specialist", blurb: "Shown next to your name.", price: 1_500_000 },
  { id: "title-magic-weekend", kind: "title", name: "Magic Weekend Regular", blurb: "Shown next to your name.", price: 2_500_000 },
  { id: "title-derby-day", kind: "title", name: "Derby Day Hero", blurb: "Shown next to your name.", price: 3_000_000 },
  { id: "title-cup-king", kind: "title", name: "Cup King", blurb: "Shown next to your name.", price: 5_000_000 },
  { id: "title-league-leader", kind: "title", name: "League Leader", blurb: "Shown next to your name.", price: 6_000_000 },
  { id: "title-man-of-steel", kind: "title", name: "Man of Steel", blurb: "Shown next to your name.", price: 12_000_000 },
  { id: "title-dynasty", kind: "title", name: "Dynasty Builder", blurb: "Shown next to your name.", price: 22_500_000 },
  { id: "title-27-0-legend", kind: "title", name: "27-0 Legend", blurb: "The rarest title in the game.", price: 30_000_000 },

  { id: "frame-studs", kind: "frame", name: "Stud marks", blurb: "A dotted line, like boots on fresh grass.", price: 75_000, tier: "starter" },
  { id: "frame-touchline", kind: "frame", name: "Touchline", blurb: "A dashed white line round your row.", price: 150_000, tier: "starter" },
  { id: CHALK_FRAME_ID, kind: "frame", name: "Chalk frame", blurb: "A chalk-white line round your row.", price: 300_000, tier: "starter" },
  { id: "frame-club-colours", kind: "frame", name: "Club colours", blurb: "Your theme's colour round your row.", price: 500_000 },
  { id: "frame-gold", kind: "frame", name: "Gold frame", blurb: "A gold border round your row.", price: 2_000_000 },
  { id: "frame-foil", kind: "frame", name: "Foil frame", blurb: "A shiny foil border round your row.", price: 3_000_000 },
  { id: "frame-programme", kind: "frame", name: "Matchday programme", blurb: "Your row in cream and ink, like an old programme.", price: 2_000_000 },
  { id: "frame-bronze", kind: "frame", name: "Bronze frame", blurb: "A bronze border round your row.", price: 800_000 },
  { id: "frame-silver", kind: "frame", name: "Silver frame", blurb: "A silver border round your row.", price: 1_400_000 },
  { id: "frame-emerald", kind: "frame", name: "Emerald frame", blurb: "A deep green glow round your row.", price: 2_500_000 },
  { id: "frame-ruby", kind: "frame", name: "Ruby frame", blurb: "A rich red glow round your row.", price: 2_500_000 },
  { id: "frame-sapphire", kind: "frame", name: "Sapphire frame", blurb: "A bright blue glow round your row.", price: 2_500_000 },
  { id: "frame-floodlight", kind: "frame", name: "Floodlight", blurb: "Your row lit up like a night game.", price: 4_000_000 },
  { id: "frame-scarf", kind: "frame", name: "Bar scarf", blurb: "Striped edges, like a terrace scarf.", price: 4_000_000 },
  { id: "frame-diamond", kind: "frame", name: "Diamond frame", blurb: "A sparkling white edge. Top of the pile.", price: 15_000_000 },

  { id: ONE_CLUB_MODE_ID, kind: "mode", name: "One-Club XI", blurb: "Build one club's all-time 13.", price: 0, notForSale: true },
  { id: GAUNTLET_MODE_ID, kind: "mode", name: "Gauntlet", blurb: "Beat great Grand Final winners in a row.", price: 0, notForSale: true },
  { id: PAST_DAILIES_MODE_ID, kind: "mode", name: "Past Dailies", blurb: "Replay recent Dailies as practice.", price: 0, notForSale: true },
  { id: BALL_KNOWER_ID, kind: "mode", name: "Ball Knower mode", blurb: "Classic with ratings hidden and no respins. Unlocked by going 27-0.", price: 0, notForSale: true },

  // Squad Book club collection titles (earned at 100% of a club, never sold): lib/collection-rewards.ts.
  ...COLLECTION_REWARD_COSMETICS,
];

/** Ready-made shirts for the kit items (everything of kind "kit" except the designer). */
export const KIT_PRESETS: Record<string, ClubKit> = {
  "kit-training-bib": { pattern: "band", body: "#F97316", trim: "#FFFFFF" },
  "kit-blue-hoops": { pattern: "hoops", body: "#0A2540", trim: "#FFFFFF" },
  "kit-retro-v": { pattern: "v", body: "#FDE68A", trim: "#7B1C3A" },
  "kit-away-teal": { pattern: "band", body: "#0D9488", trim: "#FFFFFF", trim2: "#0A2540" },
  "kit-heritage-stripes": { pattern: "stripes", body: "#14532D", trim: "#C9A227" },
  [KIT_PERFECT_ID]: { pattern: "v", body: "#111111", trim: "#C9A227", trim2: "#FDE68A" },
  [KIT_29_0_ID]: { pattern: "band", body: "#FFFFFF", trim: "#C9A227", trim2: "#111111" },
  [KIT_STREAK_30_ID]: { pattern: "hoops", body: "#38BDF8", trim: "#0A2540" },
  [KIT_STREAK_100_ID]: { pattern: "centre-stripe", body: "#7B1C3A", trim: "#C9A227", trim2: "#FFFFFF" },
  [KIT_MANAGER_GF_ID]: { pattern: "yoke", body: "#0A2540", trim: "#E30613", trim2: "#FFFFFF" },
};

export const isKitPreset = (id: string | null | undefined): boolean => !!id && id in KIT_PRESETS;

export function cosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export const titleName = (id: string | null | undefined): string | null => (id ? cosmeticById(id)?.name ?? null : null);

/** Items of one kind for the Store: Starter rung first, then the catalogue order. */
export function cosmeticsOfKind(kind: CosmeticKind): CosmeticItem[] {
  const all = COSMETICS.filter((c) => c.kind === kind && !c.notForSale && !isCollectionRewardId(c.id));
  const starter = all.filter((c) => c.tier === "starter");
  // The rest cheapest first, so each tab reads as a ladder (stable for equal prices).
  const rest = all.filter((c) => c.tier !== "starter").sort((a, b) => a.price - b.price);
  return [...starter.sort((a, b) => a.price - b.price), ...rest];
}

export interface NextStoreUnlock {
  id: string;
  name: string;
  kind: CosmeticKind;
  price: number;
  /** Club Funds still needed (0 when affordable now). */
  remaining: number;
}

/**
 * The cheapest Store item not yet owned, for the home card's "next unlock" line. Ties go to the
 * Starter rung / catalogue order. Pass the owned ids from the cosmetics store (getCosmetics().owned)
 * so bought items drop out; with none it is simply the cheapest item in the Store.
 */
export function nextStoreUnlock(balance: number, owned: readonly string[] = []): NextStoreUnlock | null {
  let best: CosmeticItem | null = null;
  for (const item of COSMETICS) {
    if (item.notForSale || owned.includes(item.id)) continue;
    if (!best || item.price < best.price) best = item;
  }
  if (!best) return null;
  return { id: best.id, name: best.name, kind: best.kind, price: best.price, remaining: Math.max(0, best.price - Math.max(0, balance)) };
}

/* ---------------------------------------------------------------- kit designer */

export const KIT_PATTERNS: { id: KitPattern; label: string }[] = [
  { id: "hoops", label: "Hoops" },
  { id: "v", label: "V" },
  { id: "band", label: "Chest band" },
  { id: "yoke", label: "Shoulders" },
  { id: "stripes", label: "Stripes" },
  { id: "centre-stripe", label: "Centre stripe" },
];

export const KIT_COLOURS: { hex: string; name: string }[] = [
  { hex: "#FFFFFF", name: "White" },
  { hex: "#111111", name: "Black" },
  { hex: "#E30613", name: "Red" },
  { hex: "#8B1538", name: "Cherry" },
  { hex: "#7B1C3A", name: "Claret" },
  { hex: "#F97316", name: "Orange" },
  { hex: "#FDB913", name: "Amber" },
  { hex: "#16A34A", name: "Green" },
  { hex: "#0066B3", name: "Blue" },
  { hex: "#0A2540", name: "Navy" },
  { hex: "#38BDF8", name: "Sky" },
  { hex: "#6D28D9", name: "Purple" },
  { hex: "#9CA3AF", name: "Silver" },
  { hex: "#C9A227", name: "Gold" },
  { hex: "#14532D", name: "Bottle green" },
  { hex: "#0D9488", name: "Teal" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#B91C1C", name: "Scarlet" },
  { hex: "#78350F", name: "Brown" },
  { hex: "#FDE68A", name: "Cream" },
];

export interface KitDesign {
  pattern: KitPattern;
  body: string;
  trim: string;
}

export const DEFAULT_KIT_DESIGN: KitDesign = { pattern: "hoops", body: "#0A2540", trim: "#FDB913" };

export function kitFromDesign(d: KitDesign): ClubKit {
  return { pattern: d.pattern, body: d.body, trim: d.trim };
}

/* ---------------------------------------------------------------- pitch styles */

export type PitchStyleId =
  | "classic"
  | "park"
  | "overcast"
  | "astro"
  | "training"
  | "dusk"
  | "floodlit"
  | "winter"
  | "snow"
  | "retro"
  | "summer"
  | "rain"
  | "checker"
  | "wide-stripes"
  | "autumn"
  | "frost"
  | "sunset"
  | "heritage"
  | "midnight"
  | "neon"
  | "grand-final";

export const PITCH_STYLES: Record<PitchStyleId, { label: string; background: string; line: string; overlay?: string }> = {
  classic: { label: "Classic", background: "repeating-linear-gradient(180deg, #15391f 0 10%, #123219 10% 20%)", line: "rgba(255,255,255,0.13)" },
  // v1.66 starter rung: patchy park grass, flat grey light, bright artificial turf.
  park: {
    label: "Park pitch",
    background:
      "radial-gradient(ellipse 18% 10% at 25% 30%, rgba(120,100,60,0.45), transparent 75%), radial-gradient(ellipse 14% 8% at 70% 65%, rgba(120,100,60,0.4), transparent 75%), linear-gradient(180deg, #3d6b35, #355f2e)",
    line: "rgba(255,255,255,0.22)",
  },
  overcast: {
    label: "Overcast",
    background: "linear-gradient(180deg, rgba(150,160,170,0.3), rgba(90,100,110,0.2)), repeating-linear-gradient(180deg, #2a4a33 0 10%, #26432e 10% 20%)",
    line: "rgba(235,240,245,0.3)",
  },
  astro: {
    label: "Astro",
    background: "repeating-linear-gradient(180deg, #23a047 0 10%, #1e9140 10% 20%)",
    line: "rgba(255,255,255,0.55)",
  },
  // Starter rung: lighter, fresh-cut grass.
  training: { label: "Training ground", background: "repeating-linear-gradient(180deg, #2f7a3c 0 10%, #2a6d35 10% 20%)", line: "rgba(255,255,255,0.3)" },
  // Starter rung: blue-grey evening tint over the grass.
  dusk: {
    label: "Dusk",
    background:
      "linear-gradient(180deg, rgba(70,90,130,0.45), rgba(40,50,80,0.55)), repeating-linear-gradient(180deg, #27463a 0 10%, #223e33 10% 20%)",
    line: "rgba(220,228,255,0.28)",
  },
  floodlit: {
    label: "Floodlit night",
    background:
      "radial-gradient(ellipse 60% 35% at 15% 0%, rgba(255,255,240,0.18), transparent 70%), radial-gradient(ellipse 60% 35% at 85% 0%, rgba(255,255,240,0.18), transparent 70%), radial-gradient(ellipse 60% 35% at 15% 100%, rgba(255,255,240,0.12), transparent 70%), radial-gradient(ellipse 60% 35% at 85% 100%, rgba(255,255,240,0.12), transparent 70%), repeating-linear-gradient(180deg, #0f2a17 0 10%, #0c2313 10% 20%)",
    line: "rgba(255,255,255,0.2)",
  },
  winter: {
    label: "Winter mud",
    background:
      "radial-gradient(ellipse 30% 20% at 50% 50%, rgba(92,64,38,0.75), transparent 75%), radial-gradient(ellipse 22% 12% at 30% 22%, rgba(92,64,38,0.55), transparent 75%), radial-gradient(ellipse 22% 12% at 70% 78%, rgba(92,64,38,0.55), transparent 75%), repeating-linear-gradient(180deg, #2b3b1e 0 10%, #26351a 10% 20%)",
    line: "rgba(255,255,255,0.1)",
  },
  snow: {
    label: "Snow game",
    background:
      "linear-gradient(90deg, rgba(240,248,255,0.65) 0 5%, transparent 9% 91%, rgba(240,248,255,0.65) 95%), repeating-linear-gradient(180deg, #1c4027 0 10%, #183a22 10% 20%)",
    line: "rgba(255,255,255,0.35)",
  },
  retro: {
    label: "Retro",
    background: "repeating-linear-gradient(180deg, #4b6b34 0 10%, #45632f 10% 20%)",
    line: "rgba(250,245,225,0.45)",
  },
  summer: {
    label: "Summer sun",
    background:
      "radial-gradient(ellipse 70% 40% at 80% 0%, rgba(255,240,180,0.22), transparent 70%), repeating-linear-gradient(180deg, #3a8a3f 0 10%, #348039 10% 20%)",
    line: "rgba(255,255,255,0.4)",
  },
  rain: {
    label: "Rain-soaked",
    background:
      "linear-gradient(180deg, rgba(60,80,100,0.35), rgba(30,40,55,0.45)), repeating-linear-gradient(180deg, #173a26 0 10%, #133322 10% 20%)",
    line: "rgba(210,225,240,0.25)",
  },
  checker: {
    label: "Checkerboard",
    background:
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 12.5%, transparent 12.5% 25%), repeating-linear-gradient(180deg, #1d4a28 0 10%, #183f22 10% 20%)",
    line: "rgba(255,255,255,0.2)",
  },
  "wide-stripes": {
    label: "Wide stripes",
    background: "repeating-linear-gradient(180deg, #1f4f2a 0 20%, #173f20 20% 40%)",
    line: "rgba(255,255,255,0.2)",
  },
  autumn: {
    label: "Autumn",
    background:
      "radial-gradient(circle at 20% 15%, rgba(205,110,40,0.55) 0 2%, transparent 3%), radial-gradient(circle at 75% 30%, rgba(180,70,30,0.55) 0 2%, transparent 3%), radial-gradient(circle at 40% 80%, rgba(220,150,50,0.5) 0 2%, transparent 3%), radial-gradient(circle at 85% 85%, rgba(190,90,35,0.5) 0 2%, transparent 3%), repeating-linear-gradient(180deg, #34452a 0 10%, #2e3d25 10% 20%)",
    line: "rgba(255,240,220,0.25)",
  },
  frost: {
    label: "Frosty morning",
    background:
      "linear-gradient(180deg, rgba(225,238,248,0.35), rgba(225,238,248,0.18)), repeating-linear-gradient(180deg, #2b4a3a 0 10%, #264233 10% 20%)",
    line: "rgba(255,255,255,0.45)",
  },
  sunset: {
    label: "Sunset",
    background:
      "linear-gradient(180deg, rgba(250,140,60,0.35), rgba(120,60,90,0.25) 45%, transparent 75%), repeating-linear-gradient(180deg, #2a4a2a 0 10%, #244024 10% 20%)",
    line: "rgba(255,230,200,0.3)",
  },
  heritage: {
    label: "Heritage",
    background: "repeating-linear-gradient(180deg, #5b5236 0 10%, #524a30 10% 20%)",
    line: "rgba(245,232,200,0.5)",
  },
  midnight: {
    label: "Midnight",
    background:
      "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(80,110,220,0.25), transparent 70%), repeating-linear-gradient(180deg, #0d1a33 0 10%, #0a152b 10% 20%)",
    line: "rgba(160,190,255,0.45)",
  },
  neon: {
    label: "Neon",
    background: "repeating-linear-gradient(180deg, #0b0d10 0 10%, #090b0d 10% 20%)",
    line: "rgba(57,255,140,0.85)",
  },
  "grand-final": {
    label: "Grand Final",
    background:
      "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,215,90,0.2), transparent 70%), repeating-linear-gradient(180deg, #17402a 0 10%, #133823 10% 20%)",
    line: "rgba(255,210,80,0.8)",
  },
};

export const pitchStyleForItem = (itemId: string | null | undefined): PitchStyleId =>
  itemId?.startsWith("pitch-") ? ((itemId.slice(6) as PitchStyleId) in PITCH_STYLES ? (itemId.slice(6) as PitchStyleId) : "classic") : "classic";
