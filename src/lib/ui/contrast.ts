/** Relative luminance (WCAG) for hex colours. */
export function getLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length < 6) return 0.5;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const transform = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return (
    0.2126 * transform(r) +
    0.299 * transform(g) +
    0.0722 * transform(b)
  );
}

export type ContrastText = "#ffffff" | "#0f1814";

const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#0f1814";

/** WCAG contrast ratio between two colours. */
export function getContrastRatio(
  foregroundHex: string,
  backgroundHex: string
): number {
  const fg = getLuminance(foregroundHex);
  const bg = getLuminance(backgroundHex);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick white or near-black text for readability on a background colour. */
export function getContrastText(backgroundHex: string): ContrastText {
  return getLuminance(backgroundHex) > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}

/**
 * Choose the most readable text colour for a given background
 * using WCAG contrast ratios (white vs near-black).
 */
export function getReadableTextColor(backgroundHex: string): ContrastText {
  const whiteRatio = getContrastRatio(LIGHT_TEXT, backgroundHex);
  const blackRatio = getContrastRatio(DARK_TEXT, backgroundHex);
  return whiteRatio >= blackRatio ? LIGHT_TEXT : DARK_TEXT;
}

/** Average luminance across multiple club colours. */
export function getContrastTextForClub(
  primary: string,
  secondary: string,
  accent?: string
): ContrastText {
  const avg =
    (getLuminance(primary) +
      getLuminance(secondary) +
      (accent ? getLuminance(accent) : getLuminance(primary))) /
    (accent ? 3 : 2);
  return avg > 0.42 ? DARK_TEXT : LIGHT_TEXT;
}

/** Text colour plus optional shadow for club-coloured panels (e.g. Leigh). */
export function getClubPanelTextStyle(backgroundHex: string): {
  color: ContrastText;
  textShadow: string;
  useStroke: boolean;
} {
  const color = getReadableTextColor(backgroundHex);
  const isLightBg = color === DARK_TEXT;

  return {
    color,
    textShadow: isLightBg
      ? "none"
      : "0 1px 2px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.6)",
    useStroke: !isLightBg,
  };
}

function darkenHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length < 6) return hex;
  const clamp = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  const r = clamp(parseInt(normalized.slice(0, 2), 16));
  const g = clamp(parseInt(normalized.slice(2, 4), 16));
  const b = clamp(parseInt(normalized.slice(4, 6), 16));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Pick a readable pill/badge background — avoids white/yellow primaries
 * that clash on dark UI (Leigh, York, Warrington, Widnes).
 */
export function getClubPillBackground(
  primary: string,
  secondary: string,
  accent?: string
): string {
  const primaryLum = getLuminance(primary);

  if (primaryLum > 0.75) {
    const candidates = [secondary, accent].filter(Boolean) as string[];
    const usable = candidates.find(
      (c) => getLuminance(c) >= 0.06 && getLuminance(c) <= 0.75
    );
    if (usable) return usable;
    return darkenHex(primary, 0.5);
  }

  if (primaryLum > 0.58) {
    return darkenHex(primary, 0.22);
  }

  return primary;
}

/** Full inline style for club-coloured pills. */
export function getClubPillStyle(
  primary: string,
  secondary: string,
  accent?: string
): {
  backgroundColor: string;
  color: ContrastText;
  textShadow: string;
  WebkitTextStroke?: string;
} {
  const bg = getClubPillBackground(primary, secondary, accent);
  const text = getClubPanelTextStyle(bg);
  return {
    backgroundColor: bg,
    color: text.color,
    textShadow: text.textShadow,
    WebkitTextStroke: text.useStroke
      ? "0.3px rgba(0,0,0,0.35)"
      : undefined,
  };
}

/** Best contrast text when label spans a two-tone club logo. */
export function getClubLogoTextColor(
  primary: string,
  secondary: string,
  accent?: string
): ContrastText {
  const darker =
    getLuminance(primary) <= getLuminance(secondary) ? primary : secondary;
  return getReadableTextColor(darker);
}

const NEAR_WHITE_LUM = 0.72;
const NEAR_BLACK_LUM = 0.14;
/** Soft readable accent on dark UI — never pure black/white. */
const SAFE_EVENT_ACCENT = "#9ecbff";

const BLOCKED_HEX = new Set(
  [
    "#000000",
    "#111111",
    "#050505",
    "#0a0a0a",
    "#ffffff",
    "#f8fafc",
    "#f2f2f2",
    "#eeeeee",
    "#fafafa",
    "white",
    "black",
  ].map((s) => s.toLowerCase())
);

function normalizeHexKey(hex: string): string {
  const t = hex.trim().toLowerCase();
  if (t === "white" || t === "black") return t;
  const n = t.startsWith("#") ? t : `#${t}`;
  if (n.length === 4) {
    return `#${n[1]}${n[1]}${n[2]}${n[2]}${n[3]}${n[3]}`;
  }
  return n;
}

export function isNearWhite(hex: string): boolean {
  if (BLOCKED_HEX.has(normalizeHexKey(hex))) {
    const key = normalizeHexKey(hex);
    return key === "white" || key === "#ffffff" || key.startsWith("#f");
  }
  return getLuminance(hex) >= NEAR_WHITE_LUM;
}

export function isNearBlack(hex: string): boolean {
  const key = normalizeHexKey(hex);
  if (BLOCKED_HEX.has(key)) {
    return key === "black" || key === "#000000" || key === "#111111" || key === "#050505" || key === "#0a0a0a";
  }
  return getLuminance(hex) <= NEAR_BLACK_LUM;
}

function isBlockedClubTextColour(hex: string): boolean {
  const key = normalizeHexKey(hex);
  if (BLOCKED_HEX.has(key)) return true;
  return isNearWhite(hex) || isNearBlack(hex);
}

/**
 * Readable team accent for dark UI (match events, labels, badge text).
 * Skips pure/near-white and near-black kit colours — never returns #000/#fff.
 */
export function getReadableTeamAccent(
  primary: string,
  secondary?: string,
  tertiary?: string,
  backgroundHex = "#0a1210"
): string {
  const candidates = [primary, secondary, tertiary].filter(
    (c): c is string => Boolean(c)
  );
  for (const colour of candidates) {
    if (isBlockedClubTextColour(colour)) continue;
    if (getContrastRatio(colour, backgroundHex) >= 2.4) return colour;
  }
  for (const colour of candidates) {
    if (isNearWhite(colour)) {
      const darkened = darkenHex(colour, 0.55);
      if (
        !isBlockedClubTextColour(darkened) &&
        getContrastRatio(darkened, backgroundHex) >= 2.4
      ) {
        return darkened;
      }
    }
  }
  return SAFE_EVENT_ACCENT;
}

/**
 * Prefer primary → secondary → accent for club-coloured TEXT/accents.
 * Rejects near-black and near-white kit colours; badge backgrounds may still use them.
 */
export function getReadableClubTextColour(colours: {
  primary: string;
  secondary: string;
  accent?: string;
}): string {
  return getReadableTeamAccent(
    colours.primary,
    colours.secondary,
    colours.accent
  );
}

/**
 * Match-event team accent only — avoids white/black kit colours so event
 * feed team names stay readable. Do not use for general club/UI text.
 */
export function getMatchEventTeamAccentColour(colours: {
  primary: string;
  secondary: string;
  accent?: string;
}): string {
  return getReadableClubTextColour(colours);
}

/** @deprecated Use getMatchEventTeamAccentColour — match events only. */
export function getReadableNonBlackWhiteTeamTextColour(colours: {
  primary: string;
  secondary: string;
  accent?: string;
}): string {
  return getMatchEventTeamAccentColour(colours);
}
