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
  currentRatingNote: "This season’s form.",
  eraRatingNote: "That season’s form.",
  protectFromMassRelease: "Protect from mass release",
  previewPlayers: "Preview Players",
  releaseSelected: "Release",
  autoPromote: "Auto promote",
  makeOffer: "Make offer",
  offerLoan: "Offer loan",
  /** Quick Mode playoff card — only when the tie can be simulated by tap. */
  tapToSimulate: "Tap to simulate",
  /** Manager review embed — user fixture is played from Hub sticky actions. */
  playFromHub: "Play from Hub",
} as const;
