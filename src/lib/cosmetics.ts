/**
 * Store cosmetics bought with Club Funds. Nothing here changes ratings or results —
 * Ball Knower mode is harder, not easier.
 */
import type { ClubKit, KitPattern } from "./club-kits";

export type CosmeticKind = "kit" | "pitch" | "title" | "frame" | "mode";

export interface CosmeticItem {
  id: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  price: number;
}

export const KIT_DESIGNER_ID = "kit-designer";
export const BALL_KNOWER_ID = "mode-ball-knower";

export const COSMETICS: CosmeticItem[] = [
  { id: KIT_DESIGNER_ID, kind: "kit", name: "Kit designer", blurb: "Design your own shirt and wear it on your Classic team sheet.", price: 1_500_000 },

  { id: "pitch-floodlit", kind: "pitch", name: "Floodlit night", blurb: "Big-match lights over a dark pitch.", price: 750_000 },
  { id: "pitch-winter", kind: "pitch", name: "Winter mud", blurb: "A heavy, churned-up February pitch.", price: 750_000 },
  { id: "pitch-snow", kind: "pitch", name: "Snow game", blurb: "Lines cleared, snow on the touchline.", price: 750_000 },
  { id: "pitch-retro", kind: "pitch", name: "Retro", blurb: "Faded grass and chalk lines, 1990s style.", price: 750_000 },

  { id: "title-ball-knower", kind: "title", name: "Ball Knower", blurb: "Shown next to your name.", price: 500_000 },
  { id: "title-spin-doctor", kind: "title", name: "Spin Doctor", blurb: "Shown next to your name.", price: 500_000 },
  { id: "title-deadline-dealer", kind: "title", name: "Deadline Day Dealer", blurb: "Shown next to your name.", price: 1_000_000 },
  { id: "title-golden-point", kind: "title", name: "Golden Point Merchant", blurb: "Shown next to your name.", price: 1_000_000 },
  { id: "title-academy-guru", kind: "title", name: "Academy Guru", blurb: "Shown next to your name.", price: 1_000_000 },
  { id: "title-gf-gaffer", kind: "title", name: "Grand Final Gaffer", blurb: "Shown next to your name.", price: 2_000_000 },
  { id: "title-invincible", kind: "title", name: "The Invincible", blurb: "Shown next to your name.", price: 5_000_000 },
  { id: "title-27-0-legend", kind: "title", name: "27-0 Legend", blurb: "The rarest title in the game.", price: 10_000_000 },

  { id: "frame-gold", kind: "frame", name: "Gold frame", blurb: "A gold border round your whole row on every leaderboard.", price: 1_000_000 },
  { id: "frame-foil", kind: "frame", name: "Foil frame", blurb: "A shimmering foil border round your whole row on every leaderboard.", price: 1_500_000 },
  { id: "frame-programme", kind: "frame", name: "Matchday programme", blurb: "Your whole row in cream and ink, like an old matchday programme.", price: 1_000_000 },

  { id: BALL_KNOWER_ID, kind: "mode", name: "Ball Knower mode", blurb: "Classic with every rating hidden and no respins. Pick on knowledge alone.", price: 2_000_000 },
];

export function cosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS.find((c) => c.id === id);
}

export const titleName = (id: string | null | undefined): string | null => (id ? cosmeticById(id)?.name ?? null : null);

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

export type PitchStyleId = "classic" | "floodlit" | "winter" | "snow" | "retro";

export const PITCH_STYLES: Record<PitchStyleId, { label: string; background: string; line: string; overlay?: string }> = {
  classic: { label: "Classic", background: "repeating-linear-gradient(180deg, #15391f 0 10%, #123219 10% 20%)", line: "rgba(255,255,255,0.13)" },
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
};

export const pitchStyleForItem = (itemId: string | null | undefined): PitchStyleId =>
  itemId?.startsWith("pitch-") ? ((itemId.slice(6) as PitchStyleId) in PITCH_STYLES ? (itemId.slice(6) as PitchStyleId) : "classic") : "classic";
