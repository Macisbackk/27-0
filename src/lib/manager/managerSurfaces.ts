import type { CSSProperties } from "react";
import { getClubIndicatorColor } from "../clubs";
import { CARD, SPACING } from "../ui/design-system";
import { getFriendlyDualBorderStyle } from "./managerFriendlyUi";
import { isChallengeCupFixture } from "./managerFixtureDisplay";
import type { ManagerCompetition } from "./types";

/**
 * Manager border system — every surface keeps the neutral pitch outline from CARD;
 * semantic colour is expressed as a left accent stripe (+ optional subtle tint).
 */

/** Shared pill / badge chrome for manager mode. */
export const MANAGER_PILL = {
  base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
  gold: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
  primary: "border-theme-primary/45 bg-theme-primary/12 text-theme-primary",
  sky: "border-sky-400/45 bg-sky-400/12 text-sky-300",
  amber: "border-amber-400/45 bg-amber-400/12 text-amber-300",
  red: "border-red-500/45 bg-red-500/12 text-red-300",
  muted: "border-pitch-600/55 bg-pitch-800/60 text-pitch-300",
  stone: "border-stone-400/45 bg-stone-500/12 text-stone-200",
} as const;

export type ManagerPillTone = keyof Omit<typeof MANAGER_PILL, "base">;

export function managerPillClass(tone: ManagerPillTone): string {
  return `${MANAGER_PILL.base} ${MANAGER_PILL[tone]}`;
}

export const MANAGER_BORDER = {
  /** Matches CARD.base / CARD.elevated outline */
  default: "border-pitch-600/55",
  subtle: "border-pitch-700/50",
  divider: "border-pitch-700/50",
  interactiveHover: "hover:border-pitch-500/55",
} as const;

const ACCENT_STRIPE = {
  gold: "border-l-4 border-l-accent-gold/60 bg-accent-gold/5",
  primary: "border-l-4 border-l-theme-primary/60 bg-theme-primary/5",
  red: "border-l-4 border-l-red-400/60 bg-red-500/5",
  amber: "border-l-4 border-l-amber-400/60 bg-amber-500/5",
  sky: "border-l-4 border-l-sky-400/55 bg-sky-400/5",
  stone: "border-l-4 border-l-stone-400/55 bg-stone-500/5",
} as const;

const COMPETITION_SURFACE: Record<
  "league" | "cup" | "playoff" | "friendly",
  string
> = {
  league: ACCENT_STRIPE.primary,
  cup: ACCENT_STRIPE.gold,
  playoff: ACCENT_STRIPE.primary,
  friendly: ACCENT_STRIPE.sky,
};

export function managerCompetitionKey(
  competition: ManagerCompetition
): keyof typeof COMPETITION_SURFACE {
  if (isChallengeCupFixture(competition)) return "cup";
  if (competition === "playoffs") return "playoff";
  if (competition === "friendly") return "friendly";
  return "league";
}

export function managerCompetitionSurfaceClass(
  competition: ManagerCompetition
): string {
  return COMPETITION_SURFACE[managerCompetitionKey(competition)];
}

export function managerCompetitionPanelClass(
  competition: ManagerCompetition,
  options?: { variant?: "elevated" | "base"; scrollMargin?: boolean }
): string {
  const surface = options?.variant === "base" ? CARD.base : CARD.elevated;
  const scroll = options?.scrollMargin ? "scroll-mt-28" : "";
  return `${surface} ${SPACING.cardPadding} ${scroll} ${managerCompetitionSurfaceClass(competition)}`.trim();
}

export function managerFixtureCardClass(
  competition: ManagerCompetition,
  options?: { scrollMargin?: boolean }
): string {
  return managerCompetitionPanelClass(competition, {
    variant: "elevated",
    scrollMargin: options?.scrollMargin,
  });
}

export function managerFixtureCardStyle(
  competition: ManagerCompetition,
  userClub: string,
  opponent: string
): CSSProperties | undefined {
  if (competition !== "friendly") return undefined;
  return getFriendlyDualBorderStyle(userClub, opponent);
}

export function managerClubAccentCardClass(): string {
  return `${CARD.elevated} ${SPACING.cardPadding} border-l-4`;
}

export function managerClubAccentCardStyle(club: string): CSSProperties {
  return { borderLeftColor: getClubIndicatorColor(club) };
}

export function managerFeaturedBannerClass(
  tone: "primary" | "gold" | "cup" = "primary"
): string {
  const accent =
    tone === "gold" || tone === "cup" ? ACCENT_STRIPE.gold : ACCENT_STRIPE.primary;
  return `${CARD.elevated} ${SPACING.cardPadding} ${accent}`;
}

export type ManagerModalHeaderTone =
  | "gold"
  | "primary"
  | "amber"
  | "red"
  | "stone"
  | "neutral";

const MODAL_HEADER_TONE: Record<ManagerModalHeaderTone, string> = {
  gold: `${MANAGER_BORDER.divider} bg-accent-gold/8`,
  primary: `${MANAGER_BORDER.divider} bg-theme-primary/8`,
  amber: `${MANAGER_BORDER.divider} bg-amber-400/8`,
  red: `${MANAGER_BORDER.divider} bg-red-500/8`,
  stone: `${MANAGER_BORDER.divider} bg-stone-500/8`,
  neutral: `${MANAGER_BORDER.divider} bg-pitch-900/40`,
};

export function managerModalHeaderClass(
  tone: ManagerModalHeaderTone,
  options?: { centered?: boolean; wide?: boolean }
): string {
  const inset = options?.wide
    ? "-mx-5 -mt-5 mb-4 px-5 py-5 sm:-mx-6 sm:-mt-6 sm:px-6"
    : "-mx-4 -mt-4 mb-4 px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6";
  const centered = options?.centered ? "text-center" : "";
  return `border-b ${inset} ${centered} ${MODAL_HEADER_TONE[tone]}`.trim();
}

/** Full-border highlight box for inline alerts (not primary card surfaces). */
export function managerCalloutClass(
  tone: "gold" | "primary" | "amber" | "red" | "sky" | "muted" = "gold"
): string {
  const map = {
    gold: `border-accent-gold/45 bg-accent-gold/10 text-accent-gold`,
    primary: `border-theme-primary/45 bg-theme-primary/10 text-theme-primary`,
    amber: `border-amber-400/45 bg-amber-400/10 text-amber-100`,
    red: `border-red-500/45 bg-red-500/10 text-red-200`,
    sky: `border-sky-400/45 bg-sky-400/10 text-sky-300`,
    muted: `${MANAGER_BORDER.default} bg-pitch-800/40 text-pitch-300`,
  };
  return `rounded-lg border px-3 py-2.5 ${map[tone]}`;
}

/** Left accent stripe for section cards — pairs with CARD surfaces. */
export function managerSectionAccentClass(
  accent: "gold" | "primary" | "red" | "amber" | "sky"
): string {
  return ACCENT_STRIPE[accent];
}

/** Inset panel with optional left accent (neutral uses CARD.inset border only). */
export function managerInsetPanelClass(
  tone?: "gold" | "primary" | "neutral"
): string {
  const base = `${CARD.inset} ${SPACING.cardPadding}`;
  if (tone === "gold") return `${base} ${ACCENT_STRIPE.gold}`;
  if (tone === "primary") return `${base} ${ACCENT_STRIPE.primary}`;
  return base;
}

/** Alert / notice panel on inset surfaces (squad warnings, migration, etc.). */
export function managerAlertPanelClass(
  tone: "gold" | "primary" | "amber" | "red"
): string {
  const stripe =
    tone === "gold"
      ? ACCENT_STRIPE.gold
      : tone === "primary"
        ? ACCENT_STRIPE.primary
        : tone === "amber"
          ? ACCENT_STRIPE.amber
          : ACCENT_STRIPE.red;
  return `${CARD.inset} ${SPACING.cardPaddingSm} ${stripe}`;
}

/** Compact list / accordion row — neutral border everywhere. */
export function managerListRowClass(interactive = true): string {
  const hover = interactive
    ? `transition ${MANAGER_BORDER.interactiveHover} hover:bg-pitch-900/50`
    : "";
  return `rounded-lg border ${MANAGER_BORDER.subtle} bg-pitch-950/40 px-3 py-2 ${hover}`;
}

/** Dense data row (squad sheet, league lists). */
export function managerDataRowClass(): string {
  return `min-w-0 rounded-lg border ${MANAGER_BORDER.subtle} bg-pitch-950/55 px-2 py-2 text-left sm:px-3 sm:py-2.5`;
}

export function managerResultBadgeClass(
  result: "win" | "loss" | "draw"
): string {
  if (result === "win") {
    return "border-theme-primary/45 bg-theme-primary/15 text-theme-primary";
  }
  if (result === "loss") {
    return "border-red-500/45 bg-red-500/15 text-red-300";
  }
  return `${MANAGER_BORDER.default} bg-pitch-800/50 text-pitch-200`;
}

function managerFixtureRowBase(): string {
  return `min-w-0 rounded-lg border ${MANAGER_BORDER.default} bg-pitch-950/50 px-3 py-3 sm:px-4 sm:py-3`;
}

export function managerFixtureRowClass(options: {
  isNext?: boolean;
  competition: ManagerCompetition;
  hasFriendlyStyle?: boolean;
}): string {
  const base = managerFixtureRowBase();

  if (options.hasFriendlyStyle) {
    return `${base} ${ACCENT_STRIPE.sky}`;
  }
  if (options.isNext) {
    return `${base} border-l-4 border-l-theme-primary/60 bg-theme-primary/6`;
  }

  const key = managerCompetitionKey(options.competition);
  if (key === "cup") return `${base} ${ACCENT_STRIPE.gold}`;
  if (key === "playoff") return `${base} ${ACCENT_STRIPE.primary}`;
  return base;
}
