/** Shared typography tokens — clean sports hierarchy (matches --text-* vars). */

export const TYPO = {
  pageTitle:
    "font-display text-[clamp(1.45rem,3vw,2rem)] font-bold tracking-tight text-white",
  /** In-app manager screen titles. */
  viewTitle:
    "font-display text-[clamp(1.45rem,3vw,2rem)] font-bold tracking-tight text-white",
  /** Home mode cards (Manager / Normal) — above body, below oversized hero. */
  homeModeTitle:
    "font-display text-[clamp(1.45rem,3vw,1.85rem)] font-bold tracking-tight text-white",
  homeModeBody: "mt-2 max-w-xl text-[0.92rem] leading-relaxed text-gray-300",
  pageSubtitle: "text-[0.92rem] text-gray-300 leading-relaxed sm:text-base",
  sectionLabel: "text-[0.8rem] font-semibold text-theme-primary",
  sectionTitle:
    "font-display text-[1.1rem] font-bold tracking-tight text-white",
  cardTitle:
    "font-display text-[0.98rem] font-bold tracking-tight text-white",
  playerName: "font-display text-xl font-semibold leading-tight text-white sm:text-2xl",
  playerNameSm: "font-display text-lg font-semibold leading-tight text-white",
  clubName: "text-[11px] font-semibold tracking-tight text-gray-400 sm:text-xs",
  statLabel: "text-[0.8rem] font-semibold uppercase tracking-wide text-gray-400",
  statValue: "text-[0.92rem] font-semibold text-white",
  statValueLg: "font-display text-xl font-bold tracking-tight text-white",
  body: "text-[0.92rem] text-gray-300 leading-relaxed",
  bodySm: "text-[0.8rem] text-gray-400 leading-relaxed",
  /** Manager in-app copy — readable on small screens. */
  managerBody: "text-[0.92rem] leading-relaxed text-gray-300",
  button: "text-[0.92rem] font-bold",
  nav: "text-[0.92rem] font-medium",
  identityLine: "text-[0.92rem] font-semibold text-gray-300 sm:text-base",
  positionHighlight: "font-semibold text-white",
  rating: "font-display font-bold text-[color:var(--rating)]",
} as const;
