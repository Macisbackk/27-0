import { TYPO } from "./typography";

/** Shared spacing tokens — padding, gaps, section margins. */
export const SPACING = {
  sectionGap: "mt-6",
  cardPadding: "p-4 sm:p-6",
  cardPaddingSm: "p-3 sm:p-4",
  cardPaddingLg: "p-6 sm:p-8",
  cardGridGap: "gap-3 sm:gap-4",
  sectionContentTop: "pt-4",
  sectionContentTopFeatured: "pt-5",
  headingMargin: "mb-3",
  buttonGap: "gap-2",
  pageX: "px-4",
  stackSm: "space-y-2",
  stackMd: "space-y-3",
  stackLg: "space-y-4",
  /** Vertical gap between navigation list items. */
  navItemGap: "space-y-2.5",
  /** Gap between navigation section groups (e.g. main nav → play → settings). */
  navSectionGap: "mt-5",
} as const;

/** Shared card surface classes. */
export const CARD = {
  base: "rounded-xl border border-pitch-600/50 bg-pitch-900/55",
  elevated:
    "rounded-xl border border-pitch-600/50 bg-gradient-to-b from-pitch-900/80 to-pitch-950/90",
  inset: "rounded-lg border border-pitch-700/50 bg-pitch-950/50",
  stat: "rl-stat-box rounded-lg border border-pitch-600/40 bg-pitch-900/55",
  hover:
    "transition hover:border-pitch-500/60 hover:bg-pitch-900/70",
  featured:
    "border border-accent-green/15 shadow-[0_0_32px_rgba(34,197,94,0.06)]",
  featuredHard:
    "border border-red-500/30 shadow-[0_0_32px_rgba(220,38,38,0.08)]",
  interactive:
    "cursor-pointer transition hover:border-accent-green/40 hover:bg-pitch-800/60",
  selected: "border-accent-green/40 bg-pitch-800/40",
  /** Legacy global panel — aligned with design system surfaces */
  panel: "matchday-panel",
  glass: "card-glass",
} as const;

/** Form & filter inputs. */
export const FILTER = {
  input:
    "w-full rounded-lg border border-pitch-600 bg-pitch-900/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-accent-green sm:px-4 sm:py-3",
  chipActive: "border-accent-green/50 bg-accent-green/10 text-accent-green",
  chipIdle: "border-pitch-600 text-gray-400 hover:text-white",
  tabGroup:
    "inline-flex w-full rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1 sm:w-auto",
} as const;

/** Shared button classes. */
export const BTN = {
  base: `${TYPO.button} inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green`,
  primary:
    "border-2 border-accent-green/75 bg-accent-green text-pitch-950 shadow-[0_0_28px_rgba(34,197,94,0.35)] hover:bg-accent-green/90 hover:shadow-[0_0_36px_rgba(34,197,94,0.45)] disabled:cursor-not-allowed disabled:opacity-50",
  primaryHard:
    "border-2 border-red-500/80 bg-red-950/75 text-red-100 shadow-[0_0_28px_rgba(220,38,38,0.45)] hover:border-red-400 hover:bg-red-950/90 hover:shadow-[0_0_36px_rgba(220,38,38,0.55)] disabled:cursor-not-allowed disabled:opacity-50",
  primaryLg:
    "w-full min-h-[52px] rounded-xl bg-gradient-to-r from-accent-green to-emerald-400 py-4 font-display text-lg font-black uppercase tracking-wider text-pitch-950 shadow-[0_0_30px_rgba(34,197,94,0.35)] transition-all hover:from-emerald-400 hover:to-accent-green hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  primaryLgHard:
    "w-full min-h-[52px] rounded-xl bg-gradient-to-r from-red-700 to-red-500 py-4 font-display text-lg font-black uppercase tracking-wider text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all hover:from-red-600 hover:to-red-400 hover:shadow-[0_0_40px_rgba(220,38,38,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "border border-pitch-600 text-gray-300 hover:border-pitch-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
  secondaryLg: "btn-secondary text-center",
  danger:
    "border border-red-600/50 bg-red-950/30 text-red-300 hover:border-red-500 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50",
  tabActive: "bg-accent-green text-pitch-950",
  tabIdle:
    "border border-pitch-600 text-gray-400 hover:border-pitch-500 hover:text-white",
  tabGroupInner:
    "flex-1 rounded-lg px-4 py-2.5 sm:flex-none sm:px-5",
  tabGroupActive:
    "border-2 border-accent-green/75 bg-accent-green text-pitch-950 shadow-[0_0_28px_rgba(34,197,94,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]",
  tabGroupIdle:
    "text-gray-400 hover:border-accent-green/30 hover:bg-accent-green/10 hover:text-accent-green",
  hardActive:
    "border-2 border-red-500/80 bg-red-950/75 text-red-100 shadow-[0_0_28px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
  hardIdle: "text-gray-400 hover:border-red-500/35 hover:bg-red-950/40 hover:text-red-300",
  accentOutline: `w-full border border-accent-green/40 bg-accent-green/10 text-accent-green hover:border-accent-green/55 hover:bg-accent-green/20 sm:w-auto`,
  hardAccentOutline: `w-full border border-red-500/45 bg-red-950/35 text-red-300 hover:border-red-500/65 hover:bg-red-950/50 hover:text-red-200 sm:w-auto`,
  goldOutline: `w-full border border-accent-gold/35 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/15 sm:w-auto`,
  goldOutlineSm: `border border-accent-gold/50 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20`,
  greenOutlineSm: `border border-accent-green/50 bg-accent-green/10 text-accent-green hover:bg-accent-green/20`,
  close: `shrink-0 min-h-[36px] rounded-lg border border-pitch-600 px-2.5 py-1 text-gray-400 transition hover:text-white`,
  closeSm: `shrink-0 rounded-lg border border-pitch-600 px-2 py-1 text-gray-400 transition hover:text-white`,
  header: `header-control-btn flex h-11 min-h-[44px] min-w-[5.75rem] items-center justify-center gap-2 rounded-lg border border-pitch-600 px-4 text-sm font-medium text-gray-300 transition hover:border-accent-green hover:text-white`,
} as const;

/** Normal mode visual tokens — green mirror of HARD. */
export const NORMAL = {
  tabGroupRing:
    "border-accent-green/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]",
  modeCardHover: "hover:border-accent-green/30 group-hover:text-accent-green",
  reviewAccent: "text-gray-500",
} as const;

/** Hard mode visual tokens — red mirror of normal green styling. */
export const HARD = {
  tabGroupRing:
    "border-red-500/45 shadow-[0_0_20px_rgba(220,38,38,0.18)]",
  modeCard: CARD.featuredHard,
  modeCardHover: "hover:border-red-500/40 group-hover:text-red-300",
  banner:
    "border border-red-500/50 bg-red-950/35 shadow-[0_0_16px_rgba(220,38,38,0.12)]",
  badge:
    "inline-flex items-center gap-2 rounded-lg border-2 border-red-500/60 bg-red-950/70 px-3 py-1.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.35)]",
  reviewAccent: "text-red-400",
  itemActive: "border border-red-500/30 bg-red-950/40 text-red-300",
  dot: "bg-red-500",
} as const;

/** Navigation & links. */
export const NAV = {
  item: `${TYPO.nav} flex min-h-[54px] items-center gap-4 rounded-xl px-[1.125rem] py-4 text-base transition`,
  itemActive: "border border-accent-green/30 bg-accent-green/10 text-accent-green",
  itemIdle: "text-gray-300 hover:bg-pitch-800/60 hover:text-white",
  list: SPACING.navItemGap,
  sectionLabel: `${TYPO.sectionLabel} mb-3 px-2`,
  sectionGap: SPACING.navSectionGap,
  icon: "shrink-0 text-lg leading-none",
  menuItem: `block w-full min-h-[44px] rounded-lg px-4 py-3 text-left ${TYPO.bodySm} transition hover:bg-pitch-800 hover:text-white`,
  menuItemDanger: `block w-full min-h-[44px] rounded-lg px-4 py-3 text-left ${TYPO.bodySm} transition hover:bg-pitch-800 hover:text-red-400`,
  menuActions: "space-y-1 px-1.5 py-1.5",
  playModeList: "space-y-4",
  playModeGroup: "space-y-2",
  nestedBlock: "space-y-2 px-1",
  nestedLabel: "px-1 font-display text-[10px] font-bold uppercase tracking-wider text-gray-500",
} as const;

export const LINK = {
  subtle: "text-sm text-gray-500 transition hover:text-white",
  accent: "text-sm text-accent-green transition hover:underline",
  footer: `${TYPO.button} inline-flex min-h-[48px] items-center gap-2.5 rounded-xl border border-pitch-600/60 bg-pitch-900/50 px-4 py-3 text-gray-400 transition hover:border-accent-green/40 hover:text-white`,
} as const;

/** Stat highlight when a side wins a comparison. */
export const STAT_HIGHLIGHT = {
  win: "text-accent-green",
  tie: "text-gray-300",
  neutral: "text-white",
  winGlow: "shadow-[0_0_8px_rgba(34,197,94,0.25)]",
} as const;

/** Tab toggle inside a tab group (Normal/Hard, Login/Signup). */
export function tabGroupButtonClass(
  active: boolean,
  variant: "normal" | "hard" = "normal"
): string {
  const base = `${TYPO.button} ${BTN.tabGroupInner} min-h-[48px] sm:min-h-[44px]`;
  if (!active) {
    return `${base} ${variant === "hard" ? BTN.hardIdle : BTN.tabGroupIdle}`;
  }
  return `${base} ${variant === "hard" ? BTN.hardActive : BTN.tabGroupActive}`;
}

/** Tab group wrapper — green ring when normal active, red when hard active. */
export function tabGroupClass(
  hardActive = false,
  normalActive = false
): string {
  if (hardActive) return `${FILTER.tabGroup} ${HARD.tabGroupRing}`;
  if (normalActive) return `${FILTER.tabGroup} ${NORMAL.tabGroupRing}`;
  return FILTER.tabGroup;
}

/** Compact nested toggle for sidebar play modes. */
export function nestedTabGroupClass(
  hardActive = false,
  normalActive = false
): string {
  const base = `${FILTER.tabGroup} w-full p-0.5`;
  if (hardActive) return `${base} ${HARD.tabGroupRing}`;
  if (normalActive) return `${base} ${NORMAL.tabGroupRing}`;
  return base;
}

export function nestedTabGroupButtonClass(
  active: boolean,
  variant: "normal" | "hard" = "normal"
): string {
  const base = `${TYPO.button} flex-1 rounded-lg px-3 py-2 min-h-[40px] text-xs sm:text-sm`;
  if (!active) {
    return `${base} ${variant === "hard" ? BTN.hardIdle : BTN.tabGroupIdle}`;
  }
  return `${base} ${variant === "hard" ? BTN.hardActive : BTN.tabGroupActive}`;
}
