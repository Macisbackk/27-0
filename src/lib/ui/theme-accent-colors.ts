import type { ClubColorSet } from "../clubs";

/** Off-white/silver accent for dark UI when a team's main visible colour is white. */
export const UI_THEME_WHITE_SOFT = "#E2E4E8";

/** Visible stand-in for black kit panels on dark app surfaces (swatches, stripes). */
export const UI_BLACK_TRIM = "#3d4340";

/** True for #000, black, rgb(0,0,0), and near-black hex values. */
export function isBlackLike(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  if (normalized === "black") return true;

  const rgbMatch = normalized.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    return r <= 24 && g <= 24 && b <= 24;
  }

  const hex = normalized.replace("#", "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) return false;

  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return r <= 24 && g <= 24 && b <= 24;
}

function parseHexRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().toLowerCase();
  const rgbMatch = normalized.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const hex = normalized.replace("#", "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) return null;

  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function isWhiteLike(color: string): boolean {
  if (isBlackLike(color)) return false;
  const rgb = parseHexRgb(color);
  if (!rgb) return false;
  return rgb.r >= 235 && rgb.g >= 235 && rgb.b >= 235;
}

function softenWhiteAccent(color: string): string {
  return isWhiteLike(color) ? UI_THEME_WHITE_SOFT : color;
}

/** Higher = better primary accent candidate for dark UI. */
function rankThemeCandidate(color: string): number {
  if (isBlackLike(color)) return -1;
  if (isWhiteLike(color)) return 1;
  return 2;
}

function normalizeHex(color: string): string {
  const trimmed = color.trim();
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function relativeLuminance(color: string): number {
  const rgb = parseHexRgb(color);
  if (!rgb) return 0.5;
  const channels = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** True when two kit colours are too close to read as a distinct gradient. */
export function colorsTooSimilar(a: string, b: string): boolean {
  const rgbA = parseHexRgb(a);
  const rgbB = parseHexRgb(b);
  if (!rgbA || !rgbB) return false;
  const dr = rgbA.r - rgbB.r;
  const dg = rgbA.g - rgbB.g;
  const db = rgbA.b - rgbB.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) < 80;
}

/**
 * Gradient stops for logos, headings, and theme buttons.
 * Uses tertiary when secondary is black or too close to primary.
 */
export function resolveThemeGradientColors(colors: {
  primary: string;
  secondary: string;
  tertiary: string;
}): {
  gradientFrom: string;
  gradientTo: string;
  logoGlow: boolean;
} {
  let gradientFrom = softenWhiteAccent(colors.primary);
  let gradientTo = colors.secondary;

  if (
    isBlackLike(colors.secondary) ||
    colorsTooSimilar(colors.primary, colors.secondary)
  ) {
    gradientTo = softenWhiteAccent(colors.tertiary);
  }

  if (isBlackLike(gradientFrom)) {
    gradientFrom = softenWhiteAccent(colors.tertiary);
    gradientTo = colors.primary;
  }

  if (normalizeHex(gradientFrom) === normalizeHex(gradientTo)) {
    gradientTo = softenWhiteAccent(colors.tertiary);
  }
  if (normalizeHex(gradientFrom) === normalizeHex(gradientTo)) {
    gradientTo = "#9CA3AF";
  }

  const lumFrom = relativeLuminance(gradientFrom);
  const lumTo = relativeLuminance(gradientTo);
  const logoGlow =
    lumFrom < 0.12 || lumTo < 0.12 || (lumFrom > 0.82 && lumTo > 0.82);

  return { gradientFrom, gradientTo, logoGlow };
}

/**
 * Pick store theme accent colours — never black as primary.
 * Chromatic team colours beat white; black stays secondary/trim when present.
 */
export function resolveThemeAccentColors(colors: ClubColorSet): {
  accent: string;
  accent2: string;
} {
  const palette = [colors.primary, colors.secondary, colors.accent].filter(
    (c): c is string => Boolean(c)
  );
  const nonBlack = palette.filter((c) => !isBlackLike(c));
  const black = palette.find(isBlackLike);

  const ranked = [...nonBlack].sort(
    (a, b) => rankThemeCandidate(b) - rankThemeCandidate(a)
  );

  let accent = softenWhiteAccent(ranked[0] ?? UI_THEME_WHITE_SOFT);

  let accent2 = black ?? ranked.find((c) => normalizeHex(c) !== normalizeHex(accent));
  if (!accent2 || normalizeHex(accent2) === normalizeHex(accent)) {
    accent2 = colors.secondary;
  }
  if (normalizeHex(accent2) === normalizeHex(accent)) {
    accent2 = black ?? "#9CA3AF";
  }

  return { accent, accent2 };
}
