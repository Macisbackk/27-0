/** Shared typography tokens — clean sports hierarchy. */

export const TYPO = {
  pageTitle:
    "font-display text-3xl font-bold tracking-tight text-white sm:text-4xl",
  /** In-app manager screen titles — smaller on mobile. */
  viewTitle:
    "font-display text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-3xl",
  pageSubtitle: "text-base text-gray-300 sm:text-lg leading-relaxed",
  sectionLabel: "text-xs font-semibold text-theme-primary",
  sectionTitle:
    "font-display text-base font-bold tracking-tight text-white sm:text-lg",
  cardTitle: "font-display text-lg font-bold tracking-tight text-white sm:text-xl",
  playerName: "font-display text-xl font-semibold leading-tight text-white sm:text-2xl",
  playerNameSm: "font-display text-lg font-semibold leading-tight text-white",
  clubName: "text-[11px] font-semibold tracking-tight text-gray-400 sm:text-xs",
  statLabel: "text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-400",
  statValue: "text-sm font-semibold text-white",
  statValueLg:
    "font-display text-xl font-bold tracking-tight text-white",
  body: "text-sm text-gray-300 leading-relaxed",
  bodySm: "text-xs text-gray-400 leading-relaxed",
  /** Manager in-app copy — readable on small screens. */
  managerBody: "text-sm leading-relaxed text-gray-300 sm:text-sm",
  button: "text-sm font-bold",
  nav: "text-sm font-medium",
  identityLine: "text-sm font-semibold text-gray-300 sm:text-base",
  positionHighlight: "font-semibold text-white",
  rating: "font-display font-bold text-[color:var(--rating)]",
} as const;
