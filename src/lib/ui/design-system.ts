import { TYPO } from "./typography";

/** Shared spacing tokens — padding, gaps, section margins. */
export const SPACING = {
  sectionGap: "mt-6",
  /** Default card padding — roomier on small screens. */
  cardPadding: "p-5 sm:p-6",
  cardPaddingSm: "p-4 sm:p-5",
  cardPaddingLg: "p-6 sm:p-8",
  cardGridGap: "gap-3 sm:gap-4",
  sectionContentTop: "pt-4",
  sectionContentTopFeatured: "pt-5",
  headingMargin: "mb-3",
  buttonGap: "gap-2",
  pageX: "px-5 sm:px-6",
  stackSm: "space-y-2",
  stackMd: "space-y-3",
  stackLg: "space-y-4",
  /** Vertical gap between navigation list items. */
  navItemGap: "space-y-1.5",
  /** Gap between navigation section groups (e.g. main nav → play → settings). */
  navSectionGap: "mt-3",
  /** Manager cards — extra breathing room on phones. */
  cardPaddingMobile: "p-5 sm:p-5 lg:p-6",
  /** Modal/sheet backdrop inset from screen edges. */
  modalBackdrop: "p-4 sm:p-6",
  /** Dense table cells on mobile. */
  tableCell: "px-3 py-2 sm:px-2.5 sm:py-1.5",
  /** Interactive list rows (squad pool, reserves, etc.). */
  listItem: "px-3 py-2.5 sm:px-2.5 sm:py-2",
  /** Bottom safe-area padding for fixed sheets / modals. */
  safeBottom: "pb-[max(1rem,env(safe-area-inset-bottom))]",
} as const;

/** Mobile-first modal / bottom-sheet pattern (matches ManagerDialog). */
export const MODAL = {
  backdrop: `fixed inset-0 z-40 flex items-end justify-center bg-black/70 ${SPACING.modalBackdrop} backdrop-blur-sm sm:items-center`,
  panel:
    "w-full max-h-[min(92dvh,900px)] overflow-y-auto overflow-x-hidden rounded-t-2xl sm:max-w-3xl sm:rounded-2xl",
  panelWide:
    "w-full max-h-[min(92dvh,900px)] overflow-y-auto overflow-x-hidden rounded-t-2xl sm:max-w-4xl sm:rounded-2xl",
  panelPadding: `p-3 sm:p-6 ${SPACING.safeBottom}`,
} as const;

/** Horizontally scrollable tab rails with snap (mobile). */
export const TAB_RAIL = {
  outer:
    "-mx-1 snap-x snap-mandatory scroll-pl-1 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  inner: "flex min-w-max gap-2",
  item: "shrink-0 snap-start",
} as const;

/** Shared card surface classes. */
export const CARD = {
  base: "rounded-xl border border-pitch-600/55 bg-pitch-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  elevated:
    "rounded-xl border border-pitch-600/55 bg-gradient-to-b from-pitch-900/85 to-pitch-950/95 shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]",
  inset:
    "rounded-lg border border-pitch-700/55 bg-pitch-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
  stat: "rl-stat-box rounded-lg border border-pitch-600/45 bg-pitch-900/60",
  hover:
    "transition hover:border-pitch-500/50 hover:bg-pitch-900/75",
  /** Accent overlay — pair with a bordered surface; border tint only (no ring/glow halo). */
  featured:
    "border-theme-tertiary/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  featuredHard:
    "border-accent-red/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  interactive:
    "btn-press cursor-pointer transition hover:border-theme-primary/45 hover:bg-pitch-800/65 active:border-theme-primary/55 active:bg-pitch-800/80",
  selected:
    "border-theme-tertiary/50 bg-pitch-800/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  /** Legacy global panel — aligned with design system surfaces */
  panel: "matchday-panel",
  /** Backdrop/blur overlay — pair with panel/base; no border (parent supplies outline). */
  glass:
    "rounded-2xl bg-pitch-800/55 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  /** Home-style featured mode card — single bordered surface */
  hero: "matchday-panel",
} as const;

/** Page layout helpers — pair with PageShell component. */
export const PAGE = {
  section: "space-y-4 sm:space-y-5 lg:space-y-4",
  sectionHero: "text-center",
  cardStack: "flex flex-col gap-4 sm:gap-5",
} as const;

/** Manager Mode layout — fluid mobile-first spacing and grids. */
export const MANAGER = {
  page: `mx-auto w-full max-w-3xl ${PAGE.section}`,
  pageWide: `mx-auto w-full max-w-5xl ${PAGE.section}`,
  /** Player pool above team sheet on mobile. */
  splitLayout:
    "grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:gap-6 [&>*:first-child]:order-2 [&>*:last-child]:order-1 lg:[&>*:first-child]:order-1 lg:[&>*:last-child]:order-2",
  statGrid2: "grid grid-cols-2 gap-2.5 sm:gap-3",
  statGrid3: "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3",
  statGrid4:
    "grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 [&>*:nth-child(3):last-child]:col-span-2 sm:[&>*:nth-child(3):last-child]:col-span-1",
  tabGrid:
    "flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 scroll-pl-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-4 sm:gap-2 sm:overflow-visible sm:pb-0 sm:snap-none lg:grid-cols-7",
  modalTitle: "font-display text-lg font-bold text-white sm:text-xl",
} as const;

/** Form & filter inputs. */
export const FILTER = {
  input:
    "w-full rounded-lg border border-pitch-600 bg-pitch-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-theme-primary sm:px-4 sm:py-3",
  chipActive:
    "border-theme-tertiary/60 bg-theme-primary/10 text-theme-primary",
  chipIdle: "border-pitch-600 text-gray-400 hover:text-white",
  tabGroup:
    "flex w-full flex-wrap rounded-xl border border-pitch-600/60 bg-pitch-900/80 p-1 sm:inline-flex sm:w-auto sm:flex-nowrap",
} as const;

/** Shared pressed-state utility — pair with BTN.base on interactive elements. */
export const BTN_PRESS = "btn-press";

/** Store theme trim for toggle groups / panels */
export const THEME = {
  /** Border-color accent — parent tab group already has a base border. */
  tabGroupRing: "border-theme-tertiary/30",
} as const;

/** Shared button classes — prefer GameButton / getGameButtonClass for new code. */
export const BTN = {
  base: `${TYPO.button} btn-press inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 transition focus-visible:outline-none disabled:active:scale-100 disabled:active:brightness-100`,
  theme:
    "game-button game-button--theme btn-press-glow game-button--md disabled:cursor-not-allowed disabled:opacity-50",
  themeLg:
    "game-button game-button--theme btn-press-glow game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  /** @deprecated Alias for BTN.theme */
  primary:
    "game-button game-button--theme btn-press-glow game-button--md disabled:cursor-not-allowed disabled:opacity-50",
  primaryHard:
    "btn-press-glow-hard border-2 border-accent-red/85 bg-accent-red text-white shadow-[0_0_28px_rgba(239,68,68,0.45)] hover:bg-red-500 hover:shadow-[0_0_36px_rgba(239,68,68,0.55)] disabled:cursor-not-allowed disabled:opacity-50",
  /** @deprecated Use BTN.themeLg */
  primaryLg:
    "game-button game-button--theme btn-press-glow game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  primaryLgHard:
    "game-button game-button--current game-button--current-hard btn-press-glow-hard game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  eraStart:
    "game-button game-button--era btn-press-glow-gold game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  eraStartLg:
    "game-button game-button--era btn-press-glow-gold game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  eraStartCompact:
    "game-button game-button--era btn-press-glow-gold game-button--sm w-full disabled:cursor-not-allowed disabled:opacity-50",
  currentStart:
    "game-button game-button--current btn-press-glow game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  currentStartHard:
    "game-button game-button--current game-button--current-hard btn-press-glow-hard game-button--lg w-full disabled:cursor-not-allowed disabled:opacity-50",
  currentStartCompact:
    "game-button game-button--current btn-press-glow game-button--sm w-full disabled:cursor-not-allowed disabled:opacity-50",
  currentStartCompactHard:
    "game-button game-button--current game-button--current-hard btn-press-glow-hard game-button--sm w-full disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "border border-pitch-600 text-gray-300 hover:border-theme-tertiary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
  secondaryThemed:
    "game-button game-button--secondary btn-press game-button--md disabled:cursor-not-allowed disabled:opacity-50",
  secondaryLg: "btn-secondary text-center",
  danger:
    "border border-red-600/50 bg-red-950/30 text-red-300 hover:border-red-500 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50",
  success:
    "game-button game-button--success btn-press game-button--md disabled:cursor-not-allowed disabled:opacity-50",
  tabActive: "bg-theme-primary text-[var(--theme-text-on-primary)]",
  tabIdle:
    "border border-transparent text-gray-400 hover:bg-pitch-800/60 hover:text-white",
  tabGroupInner:
    "flex-1 rounded-lg px-4 py-2.5 sm:flex-none sm:px-5",
  tabGroupActive: "tab-group-btn-active",
  modeCurrentActive:
    "border-2 border-mode-current/75 bg-mode-current text-pitch-950 shadow-[0_0_28px_var(--mode-current-glow),inset_0_1px_0_rgba(255,255,255,0.08)]",
  modeCurrentIdle:
    "border border-theme-tertiary/25 bg-pitch-900/90 text-gray-400 hover:border-theme-tertiary/50 hover:text-white",
  tabGroupIdle:
    "border border-transparent bg-pitch-900/90 text-gray-400 hover:bg-pitch-800/80 hover:text-white",
  toggleIdle:
    "border border-transparent bg-pitch-900/90 text-gray-400 hover:bg-pitch-800/80 hover:text-white",
  hardActive:
    "border-2 border-accent-red/85 bg-accent-red text-white shadow-[0_0_28px_rgba(239,68,68,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]",
  hardIdle:
    "border border-transparent text-gray-400 hover:bg-accent-red/10 hover:text-accent-red",
  eraActive: "era-tab-btn-active",
  eraIdle:
    "border border-transparent bg-pitch-900/90 text-gray-400 hover:bg-pitch-800/80 hover:text-accent-gold",
  accentOutline: `w-full border border-theme-primary/40 bg-theme-primary/10 text-theme-primary hover:border-theme-primary/55 hover:bg-theme-primary/20 sm:w-auto`,
  hardAccentOutline: `w-full border border-accent-red/45 bg-accent-red/10 text-accent-red hover:border-accent-red/65 hover:bg-accent-red/20 hover:text-red-300 sm:w-auto`,
  goldOutline: `w-full border-2 border-accent-gold/50 bg-accent-gold/10 text-accent-gold hover:border-accent-gold/65 hover:bg-accent-gold/20`,
  goldOutlineSm: `border border-accent-gold/50 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20`,
  /** @deprecated Use accentOutline or modeCurrentOutlineSm for Current-only controls */
  greenOutlineSm: `border border-theme-primary/50 bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20`,
  modeCurrentOutlineSm: `border border-mode-current/50 bg-mode-current/10 text-mode-current hover:bg-mode-current/20`,
  close: `shrink-0 min-h-[44px] rounded-lg border border-pitch-600 px-2.5 py-1 text-gray-400 transition hover:text-white sm:min-h-[36px]`,
  closeSm: `shrink-0 rounded-lg border border-pitch-600 px-2 py-1 text-gray-400 transition hover:text-white`,
  header: `header-control-btn flex h-11 min-h-[44px] min-w-[5.75rem] items-center justify-center gap-2 rounded-lg border border-pitch-600 px-4 text-sm font-medium text-gray-300 transition hover:border-theme-primary hover:text-white`,
} as const;

/** Normal / Current mode visual tokens — green only for mode-state controls. */
export const MODE_CURRENT = {
  tabGroupRing:
    "border-mode-current/35",
  modeCardHover: "hover:border-mode-current/30 group-hover:text-mode-current",
} as const;

/** @deprecated Use MODE_CURRENT for mode-state green. */
export const NORMAL = {
  tabGroupRing: MODE_CURRENT.tabGroupRing,
  modeCardHover: MODE_CURRENT.modeCardHover,
  reviewAccent: "text-gray-500",
} as const;

/** Era mode visual tokens — gold historic/retro accent. */
export const ERA = {
  tabGroupRing:
    "border-accent-gold/30",
  itemActive:
    "border border-accent-gold/40 bg-accent-gold/15 text-accent-gold",
  dot: "bg-accent-gold",
} as const;

/** Hard mode visual tokens — red mirror of normal green styling. */
export const HARD = {
  tabGroupRing: "border-accent-red/30",
  modeCard: CARD.featuredHard,
  modeCardHover: "hover:border-accent-red/45 group-hover:text-accent-red",
  banner:
    "border border-accent-red/50 bg-accent-red/10 shadow-[0_0_16px_rgba(239,68,68,0.15)]",
  badge:
    "inline-flex items-center gap-2 rounded-lg border-2 border-accent-red/70 bg-accent-red/15 px-3 py-1.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-accent-red shadow-[0_0_18px_rgba(239,68,68,0.35)]",
  reviewAccent: "text-accent-red",
  itemActive: "border border-accent-red/40 bg-accent-red/15 text-accent-red",
  dot: "bg-accent-red",
} as const;

/** Shared nav control dimensions (sidebar, footer icons, toggles). */
export const NAV_SIZE = {
  /** Primary sidebar nav row height */
  control: "h-11 min-h-[44px]",
  /** Square icon-only link buttons */
  iconButton: "h-11 w-11 min-h-[44px] min-w-[44px]",
  /** Nested Off/On and Current/Era toggles */
  nestedToggle: "h-11 min-h-[44px] sm:h-9 sm:min-h-[36px]",
  /** Home page mode card tab buttons */
  modeTab: "h-11 min-h-[44px]",
} as const;

/** Navigation & links. */
export const NAV = {
  item: `${TYPO.nav} btn-press flex ${NAV_SIZE.control} items-center gap-2 rounded-lg border border-transparent px-2.5 text-sm transition`,
  itemActive:
    "border border-theme-tertiary/40 bg-theme-primary/10 text-theme-primary",
  itemIdle: "text-gray-300 hover:border-pitch-600/50 hover:bg-pitch-800/60 hover:text-white",
  list: "space-y-1",
  sectionLabel:
    "mb-1 px-1.5 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-theme-primary",
  sectionGap: "mt-2",
  icon: "flex h-[18px] w-[18px] shrink-0 items-center justify-center text-sm leading-none",
  menuItem: `block w-full ${NAV_SIZE.control} rounded-lg px-2.5 text-left ${TYPO.bodySm} transition hover:bg-pitch-800 hover:text-white`,
  menuItemDanger: `block w-full ${NAV_SIZE.control} rounded-lg px-2.5 text-left ${TYPO.bodySm} transition hover:bg-pitch-800 hover:text-red-400`,
  menuActions: "space-y-0.5 px-1 py-1",
  playModeList: "space-y-1",
  playModeGroup: "space-y-1",
  playModeRow: "flex items-stretch gap-1",
  hardToggle: "flex w-[6.25rem] shrink-0 flex-col justify-center",
  nestedBlock: "space-y-1 px-0",
  nestedLabel:
    "px-1 font-display text-[9px] font-bold uppercase tracking-wider text-gray-500",
  soundToggle: `btn-press flex ${NAV_SIZE.control} w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-pitch-600/60 bg-pitch-900/40 px-2.5 text-left text-sm transition hover:border-theme-primary/40 hover:bg-pitch-800/60`,
  soundStatus:
    "shrink-0 rounded border border-pitch-600/80 bg-pitch-900/60 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider",
  footer: "shrink-0 border-t border-pitch-700/50 px-2.5 py-2",
  footerLinks: "mt-1.5 flex items-center justify-center gap-2",
  supportRow: "flex items-center justify-center gap-2",
  supportLink: `btn-press inline-flex ${NAV_SIZE.iconButton} shrink-0 items-center justify-center rounded-lg border border-pitch-600/60 bg-pitch-900/40 text-gray-400 transition hover:border-theme-primary/40 hover:bg-pitch-800/60 hover:text-white`,
} as const;

export const LINK = {
  subtle: "text-sm text-gray-500 transition hover:text-white",
  accent: "text-sm text-theme-primary transition hover:underline",
  footer: `${TYPO.button} inline-flex min-h-[48px] items-center gap-2.5 rounded-xl border border-pitch-600/60 bg-pitch-900/50 px-4 py-3 text-gray-400 transition hover:border-theme-primary/40 hover:text-white`,
} as const;

/** Stat highlight when a side wins a comparison. */
export const STAT_HIGHLIGHT = {
  win: "text-theme-primary",
  tie: "text-gray-300",
  neutral: "text-white",
  winGlow: "shadow-[0_0_8px_var(--theme-glow-soft)]",
} as const;

/** Tab toggle inside a tab group (Normal/Hard, Login/Signup). */
export function tabGroupButtonClass(
  active: boolean,
  variant: "normal" | "current" | "hard" | "era" | "gold" = "normal"
): string {
  const base = `${TYPO.button} btn-press flex flex-1 items-center justify-center text-center ${BTN.tabGroupInner} ${NAV_SIZE.modeTab}`;
  if (!active) {
    if (variant === "hard") return `${base} ${BTN.hardIdle}`;
    if (variant === "era") return `${base} ${BTN.toggleIdle}`;
    if (variant === "gold") return `${base} ${BTN.eraIdle}`;
    if (variant === "current") return `${base} ${BTN.toggleIdle}`;
    return `${base} ${BTN.tabGroupIdle}`;
  }
  if (variant === "hard") return `${base} ${BTN.hardActive}`;
  if (variant === "era") return `${base} ${BTN.eraActive}`;
  if (variant === "gold") {
    return `${base} border-2 border-accent-gold/50 bg-accent-gold/10 text-accent-gold shadow-[0_0_16px_rgba(251,191,36,0.2)]`;
  }
  /* "current" and "normal" — selected tab uses Store theme, not fixed mode green */
  if (variant === "current" || variant === "normal") return `${base} ${BTN.tabGroupActive}`;
  return `${base} ${BTN.tabGroupActive}`;
}

/** Tab group wrapper — single base border; accent ring follows active mode. */
export function tabGroupClass(
  hardActive = false,
  _currentModeActive = false,
  eraActive = false
): string {
  const accent = hardActive
    ? HARD.tabGroupRing
    : eraActive
      ? ERA.tabGroupRing
      : THEME.tabGroupRing;
  return `${FILTER.tabGroup} ${accent}`;
}

/** Compact nested toggle for sidebar play modes. */
export function nestedTabGroupClass(
  hardActive = false,
  _currentModeActive = false,
  eraActive = false
): string {
  const accent = hardActive
    ? HARD.tabGroupRing
    : eraActive
      ? ERA.tabGroupRing
      : THEME.tabGroupRing;
  return `${FILTER.tabGroup} w-full p-0.5 ${accent}`;
}

export function nestedTabGroupButtonClass(
  active: boolean,
  variant: "normal" | "current" | "hard" | "era" | "gold" = "normal"
): string {
  const base = `${TYPO.button} btn-press flex-1 rounded-md px-2 ${NAV_SIZE.nestedToggle} text-[10px] font-semibold uppercase tracking-wide`;
  if (!active) {
    if (variant === "hard") return `${base} ${BTN.hardIdle}`;
    if (variant === "era") return `${base} ${BTN.toggleIdle}`;
    if (variant === "gold") return `${base} ${BTN.eraIdle}`;
    if (variant === "current") return `${base} ${BTN.toggleIdle}`;
    return `${base} ${BTN.tabGroupIdle}`;
  }
  if (variant === "hard") return `${base} ${BTN.hardActive}`;
  if (variant === "era") return `${base} ${BTN.eraActive}`;
  if (variant === "gold") {
    return `${base} border border-accent-gold/50 bg-accent-gold/10 text-accent-gold`;
  }
  if (variant === "current" || variant === "normal") return `${base} ${BTN.tabGroupActive}`;
  return `${base} ${BTN.tabGroupActive}`;
}
