import type { CSSProperties } from "react";
import { getClubIndicatorColor } from "../clubs";
import { CARD, SPACING } from "../ui/design-system";
import { getFriendlyDualBorderStyle } from "./managerFriendlyUi";
import { isChallengeCupFixture } from "./managerFixtureDisplay";
import type { ManagerCompetition } from "./types";

/** Shared pill / badge chrome for manager mode. */
export const MANAGER_PILL = {
  base: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
  gold: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
  primary: "border-theme-primary/45 bg-theme-primary/12 text-theme-primary",
  sky: "border-sky-400/45 bg-sky-400/12 text-sky-300",
  amber: "border-amber-400/45 bg-amber-400/12 text-amber-300",
  red: "border-red-500/45 bg-red-500/12 text-red-300",
  muted: "border-pitch-600/45 bg-pitch-800/60 text-pitch-300",
  stone: "border-stone-400/45 bg-stone-500/12 text-stone-200",
} as const;

export type ManagerPillTone = keyof Omit<typeof MANAGER_PILL, "base">;

export function managerPillClass(tone: ManagerPillTone): string {
  return `${MANAGER_PILL.base} ${MANAGER_PILL[tone]}`;
}

export const MANAGER_BORDER = {
  default: "border-pitch-600/50",
  subtle: "border-pitch-700/45",
  divider: "border-pitch-700/50",
} as const;

const COMPETITION_SURFACE: Record<
  "league" | "cup" | "playoff" | "friendly",
  string
> = {
  league: "border-l-4 border-l-theme-primary/55",
  cup: "border-accent-gold/45 bg-accent-gold/10",
  playoff: "border-theme-primary/45 bg-theme-primary/10",
  friendly: "border-sky-400/40 bg-sky-400/5",
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

export function managerFixtureCardClass(
  competition: ManagerCompetition,
  options?: { scrollMargin?: boolean }
): string {
  const scroll = options?.scrollMargin ? "scroll-mt-28" : "";
  return `${CARD.elevated} ${SPACING.cardPadding} ${scroll} ${managerCompetitionSurfaceClass(competition)}`.trim();
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
    tone === "gold" || tone === "cup"
      ? "border-accent-gold/45 bg-gradient-to-b from-accent-gold/10 to-pitch-950/95"
      : "border-theme-primary/45 bg-gradient-to-b from-theme-primary/10 to-pitch-950/95";
  return `${CARD.elevated} ${SPACING.cardPadding} border ${accent}`;
}

export type ManagerModalHeaderTone =
  | "gold"
  | "primary"
  | "amber"
  | "red"
  | "stone"
  | "neutral";

const MODAL_HEADER_TONE: Record<ManagerModalHeaderTone, string> = {
  gold: "border-accent-gold/45 bg-accent-gold/10",
  primary: "border-theme-primary/45 bg-theme-primary/10",
  amber: "border-amber-400/45 bg-amber-400/10",
  red: "border-red-500/45 bg-red-500/10",
  stone: "border-stone-400/45 bg-stone-500/10",
  neutral: "border-pitch-600/50 bg-pitch-900/40",
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

export function managerCalloutClass(
  tone: "gold" | "primary" | "amber" | "red" = "gold"
): string {
  const map = {
    gold: "border-accent-gold/45 bg-accent-gold/10 text-accent-gold",
    primary: "border-theme-primary/45 bg-theme-primary/10 text-theme-primary",
    amber: "border-amber-400/45 bg-amber-400/10 text-amber-100",
    red: "border-red-500/45 bg-red-500/10 text-red-200",
  };
  return `rounded-lg border px-3 py-2.5 ${map[tone]}`;
}

export function managerSectionAccentClass(
  accent: "gold" | "primary" | "red" | "amber" | "sky"
): string {
  const map = {
    gold: "border-l-4 border-l-accent-gold/55",
    primary: "border-l-4 border-l-theme-primary/55",
    red: "border-l-4 border-l-red-400/55",
    amber: "border-l-4 border-l-amber-400/55",
    sky: "border-l-4 border-l-sky-400/55",
  };
  return map[accent];
}

export function managerFixtureRowClass(options: {
  isNext?: boolean;
  competition: ManagerCompetition;
  hasFriendlyStyle?: boolean;
}): string {
  const base = "rounded-lg border px-4 py-3.5 sm:px-4 sm:py-3";
  if (options.hasFriendlyStyle) {
    return `${base} border-sky-400/40 bg-sky-400/5`;
  }
  if (options.isNext) {
    return `${base} border-theme-primary/45 bg-theme-primary/8`;
  }
  const key = managerCompetitionKey(options.competition);
  if (key === "cup") return `${base} border-accent-gold/45 bg-accent-gold/8`;
  if (key === "playoff") {
    return `${base} border-theme-primary/40 bg-theme-primary/8`;
  }
  return `${base} border-pitch-700/45 bg-pitch-950/50`;
}

export function managerInsetPanelClass(
  tone?: "gold" | "primary" | "neutral"
): string {
  const base = `${CARD.inset} ${SPACING.cardPadding}`;
  if (tone === "gold") {
    return `${base} border-accent-gold/45 bg-accent-gold/8`;
  }
  if (tone === "primary") {
    return `${base} border-theme-primary/45 bg-theme-primary/8`;
  }
  return base;
}
