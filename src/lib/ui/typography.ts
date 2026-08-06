/** Shared typography tokens — clean sports hierarchy (matches --text-* vars). */

export const TYPO = {
  pageTitle:
    "font-display text-[length:var(--text-page-title)] font-bold tracking-tight text-white leading-[1.2]",
  /** In-app manager screen titles. */
  viewTitle:
    "font-display text-[length:var(--text-page-title)] font-bold tracking-tight text-white leading-[1.2]",
  /** Home mode cards (Manager / Normal) — above body, below oversized hero. */
  homeModeTitle:
    "font-display text-[clamp(1.28rem,3vw,1.85rem)] font-bold tracking-tight text-white leading-[1.2]",
  homeModeBody:
    "mt-2 max-w-xl text-[length:var(--text-body)] leading-relaxed text-gray-300",
  pageSubtitle:
    "text-[length:var(--text-body)] text-gray-300 leading-relaxed",
  sectionLabel:
    "text-[length:var(--text-small)] font-semibold text-theme-primary",
  sectionTitle:
    "font-display text-[length:var(--text-section-title)] font-bold tracking-tight text-white leading-[1.25]",
  cardTitle:
    "font-display text-[length:var(--text-card-title)] font-bold tracking-tight text-white leading-[1.25]",
  playerName:
    "font-display text-[length:var(--text-section-header)] font-semibold leading-tight text-white",
  playerNameSm:
    "font-display text-[length:var(--text-card-title)] font-semibold leading-tight text-white",
  clubName:
    "text-[length:var(--text-small)] font-semibold tracking-tight text-gray-400",
  /** Fixture / rating key labels (e.g. Wins, Losses, Your Rating). */
  keyLabel:
    "text-[length:var(--text-small)] font-semibold uppercase tracking-wide text-gray-400",
  statLabel:
    "text-[length:var(--text-small)] font-semibold uppercase tracking-wide text-gray-400",
  statValue:
    "text-[length:var(--text-body)] font-semibold text-white",
  statValueLg:
    "font-display text-[length:var(--text-section-header)] font-bold tracking-tight text-white",
  body:
    "text-[length:var(--text-body)] text-gray-300 leading-relaxed",
  bodySm:
    "text-[length:var(--text-small)] text-gray-400 leading-snug",
  /** Manager in-app copy — readable on small screens. */
  managerBody:
    "text-[length:var(--text-body)] leading-relaxed text-gray-300",
  /** Priority-3 metadata — never compete with primary actions. */
  meta:
    "text-[length:var(--text-small)] leading-snug text-pitch-500",
  button: "text-[length:var(--text-body)] font-bold",
  nav: "text-[length:var(--text-body)] font-medium",
  identityLine:
    "text-[length:var(--text-body)] font-semibold text-gray-300",
  positionHighlight: "font-semibold text-white",
  rating: "font-display font-bold text-[color:var(--rating)]",
} as const;

export type TypographyRole = keyof typeof TYPO;
