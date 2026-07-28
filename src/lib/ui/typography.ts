/** Shared typography tokens — use across all screens. */

export const TYPO = {
  pageTitle:
    "font-[family-name:var(--font-pitch)] text-3xl uppercase tracking-[0.04em] text-white sm:text-4xl",
  /** In-app manager screen titles — smaller on mobile. */
  viewTitle:
    "font-[family-name:var(--font-pitch)] text-xl uppercase tracking-[0.04em] text-white sm:text-2xl lg:text-3xl",
  pageSubtitle: "text-base text-gray-400 sm:text-lg leading-relaxed",
  sectionLabel:
    "font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-theme-primary",
  sectionTitle:
    "font-display text-sm font-bold uppercase tracking-wider text-theme-primary",
  cardTitle: "font-display text-lg font-bold text-white sm:text-xl",
  playerName: "font-display text-xl font-semibold leading-tight text-white sm:text-2xl",
  playerNameSm: "font-display text-lg font-semibold leading-tight text-white",
  clubName: "font-display text-[10px] font-bold uppercase tracking-wide text-gray-300 sm:text-xs",
  statLabel: "text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-gray-500",
  statValue: "text-sm font-medium text-white",
  statValueLg:
    "font-[family-name:var(--font-pitch)] text-xl tracking-[0.02em] text-white",
  body: "text-sm text-gray-400 leading-relaxed",
  bodySm: "text-xs text-gray-500 leading-relaxed",
  /** Manager in-app copy — readable on small screens. */
  managerBody: "text-sm leading-relaxed text-pitch-400 sm:text-sm sm:text-pitch-500",
  button: "font-display text-xs font-bold uppercase tracking-[0.15em]",
  nav: "text-sm font-medium",
  identityLine: "text-sm font-semibold text-gray-300 sm:text-base",
  positionHighlight: "font-semibold text-white",
  rating: "font-display font-black text-theme-primary",
} as const;
