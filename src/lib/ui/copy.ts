/**
 * Central UI copy for repeated interface labels.
 * Prefer these over ad-hoc strings so audits stay consistent.
 */
export const UI_COPY = {
  viewDetails: "View Details",
  managePlayer: "Manage player",
  playGame: "Play Game",
  simulateGame: "Simulate Game",
  progressWeek: "Progress Week",
  progressingWeek: "Progressing…",
  selectPlayer: "Select",
  respin: "Respin",
  continue: "Continue",
  confirm: "Confirm",
  cancel: "Cancel",
  filters: "Filters",
  boostedFirstPick: "Boosted First Pick",
  randomValidPosition: (position: string) =>
    `Random valid position: ${position}`,
  currentRatingNote: "Ratings reflect 2026 form.",
  eraRatingNote: "Ratings reflect form in that season.",
  protectFromMassRelease: "Protect from mass release",
  previewPlayers: "Preview Players",
  releaseSelected: "Release",
  autoPromote: "Auto promote",
  makeOffer: "Make offer",
  offerLoan: "Offer loan",
  /** Quick Mode playoff card — only when the tie can be simulated by tap. */
  tapToSimulate: "Tap to simulate",
  /** Manager review embed — user fixture is played from Hub sticky actions. */
  playFromHub: "Up next",
} as const;
