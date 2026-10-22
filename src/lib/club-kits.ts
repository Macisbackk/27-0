import { getClubByName } from "@/lib/clubs";
import { getLuminance } from "@/lib/ui/contrast";

/**
 * Two-colour shirt designs for the team sheet.
 * Each pattern gives the second colour a big share of the shirt, so a club never reads as one flat colour.
 */
export type KitPattern =
  | "hoops" // horizontal hoops, roughly half and half (Wigan, Hull FC, Halifax)
  | "v" // a wide V from the shoulders (St Helens, Wakefield)
  | "band" // a broad chest band with matching collar and cuffs (Hull KR, Leeds)
  | "yoke" // shoulders and sleeves in the second colour (Castleford)
  | "stripes" // vertical stripes (Catalans' senyera)
  | "centre-stripe"; // one bold vertical stripe down the middle (PSG)

export interface ClubKit {
  pattern: KitPattern;
  /** Main shirt colour. */
  body: string;
  /** Second colour: hoops, V, band, yoke or stripes, plus collar and cuffs. */
  trim: string;
  /** Optional third colour: edges the V / stripe, or the collar. */
  trim2?: string;
}

/** Hand-picked kits by club id. Anything not listed falls back to the club's own two colours. */
const KITS: Record<string, ClubKit> = {
  // Super League
  wigan: { pattern: "hoops", body: "#8B1538", trim: "#FFFFFF" },
  "st-helens": { pattern: "v", body: "#FFFFFF", trim: "#E30613" },
  warrington: { pattern: "band", body: "#FDB913", trim: "#0066B3" },
  leeds: { pattern: "band", body: "#0066B3", trim: "#FDB913" },
  bradford: { pattern: "v", body: "#FFFFFF", trim: "#E30613", trim2: "#111111" },
  catalans: { pattern: "stripes", body: "#FDB913", trim: "#D0102B" },
  "hull-fc": { pattern: "hoops", body: "#111111", trim: "#FFFFFF" },
  "hull-kr": { pattern: "band", body: "#FFFFFF", trim: "#E30613" },
  leigh: { pattern: "band", body: "#E30613", trim: "#FFFFFF", trim2: "#111111" },
  wakefield: { pattern: "v", body: "#FFFFFF", trim: "#0066B3", trim2: "#E30613" },
  castleford: { pattern: "yoke", body: "#FDB913", trim: "#111111" },
  huddersfield: { pattern: "v", body: "#7B1C3A", trim: "#FDB913" },
  salford: { pattern: "yoke", body: "#E30613", trim: "#111111" },
  toulouse: { pattern: "v", body: "#FFFFFF", trim: "#0066B3" },
  york: { pattern: "band", body: "#111111", trim: "#FDB913" },
  // Championship and former clubs
  london: { pattern: "v", body: "#0A2540", trim: "#C8102E", trim2: "#FFFFFF" },
  widnes: { pattern: "v", body: "#FFFFFF", trim: "#111111" },
  halifax: { pattern: "hoops", body: "#1E4D9B", trim: "#FFFFFF" },
  sheffield: { pattern: "v", body: "#C8102E", trim: "#C9A227", trim2: "#111111" },
  oldham: { pattern: "hoops", body: "#FFFFFF", trim: "#C8102E" },
  psg: { pattern: "centre-stripe", body: "#004170", trim: "#DA291C", trim2: "#FFFFFF" },
  crusaders: { pattern: "v", body: "#111111", trim: "#E30613" },
  featherstone: { pattern: "v", body: "#0B2A5B", trim: "#FFFFFF" },
  // NRL
  "nrl-south-sydney-rabbitohs": { pattern: "hoops", body: "#007A3D", trim: "#D71920" },
  "nrl-st-george-illawarra-dragons": { pattern: "v", body: "#FFFFFF", trim: "#D71920" },
  "nrl-sydney-roosters": { pattern: "v", body: "#002B5C", trim: "#FFFFFF", trim2: "#D71920" },
  "nrl-brisbane-broncos": { pattern: "v", body: "#5A0A2C", trim: "#FBBF24" },
  "nrl-parramatta-eels": { pattern: "hoops", body: "#0057B8", trim: "#FBBF24" },
  "nrl-canterbury-bulldogs": { pattern: "v", body: "#FFFFFF", trim: "#0054A6" },
  "nrl-newcastle-knights": { pattern: "v", body: "#005EB8", trim: "#D71920" },
  "nrl-melbourne-storm": { pattern: "v", body: "#4B2E83", trim: "#FBBF24" },
};

const NEUTRAL_KIT: ClubKit = { pattern: "band", body: "#374151", trim: "#9CA3AF" };

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Rough "can you tell these two apart on a small shirt" check. */
function distinct(a: string, b: string): boolean {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a.toLowerCase() !== b.toLowerCase();
  const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  return d > 90;
}

/** Shirt design for a club name (era suffixes like "Wigan '96" are handled by getClubByName). */
export function getClubKit(clubName: string): ClubKit {
  const club = getClubByName(clubName);
  if (!club) return NEUTRAL_KIT;
  const known = KITS[club.id];
  if (known) return known;

  const body = club.primaryColor;
  const candidates = [club.secondaryColor, club.accentColor].filter((c): c is string => Boolean(c));
  let trim = candidates.find((c) => distinct(c, body));
  if (!trim) trim = getLuminance(body) > 0.5 ? "#111111" : "#FFFFFF";
  const trim2 = club.accentColor && club.accentColor !== trim && distinct(club.accentColor, body) ? club.accentColor : undefined;
  return { pattern: "v", body, trim, trim2 };
}

/** True when a colour is light enough to need a dark outline on the pitch. */
export function isLightKitColor(hex: string): boolean {
  return getLuminance(hex) > 0.55;
}
