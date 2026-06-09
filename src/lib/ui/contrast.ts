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
