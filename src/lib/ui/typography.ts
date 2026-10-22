/** Shared typography tokens — clean sports hierarchy (matches --text-* vars).
 *  Display = Anton (`font-display`). Floodlights (v1.94+) keeps Anton for big
 *  numbers only (`fl-number`); new screens should prefer `cardHeading` /
 *  `label` / `muted`, which are Inter.
 */

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
  /** Small label above a title (review / play-off screens, Daily header).
   *  Floodlights: 13px semibold Inter, sentence case. No colour — callers pick
   *  one (e.g. `text-[color:var(--fl-muted)]`, `text-accent-gold`). */
  eyebrow: "text-[13px] font-semibold leading-snug",
  /** Floodlights card / section heading — ~17px bold Inter. */
  cardHeading: "text-[17px] font-bold leading-tight tracking-tight text-white",
  /** Floodlights small label — 12–13px semibold, muted, sentence case. */
  label: "text-[13px] font-semibold leading-snug text-[color:var(--fl-muted)]",
  /** Floodlights secondary copy — muted body text. */
  muted: "text-sm leading-relaxed text-[color:var(--fl-muted)]",
  /** Quiz / mini-game mode picker card titles. */
  modeCardTitle:
    "font-display text-base font-bold uppercase tracking-wide sm:text-lg",
  /** Millionaire prize amounts and other hero money figures. */
  prizeDisplay:
    "font-display font-black tabular-nums tracking-tight text-accent-gold",
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
  /** Match / table club names — matches playoff bracket team text. */
  matchClub:
    "font-semibold leading-snug text-white [overflow-wrap:anywhere]",
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
