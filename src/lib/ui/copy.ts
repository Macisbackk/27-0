/**
 * Central UI copy for repeated interface labels.
 * Prefer these over ad-hoc strings so audits stay consistent.
 */
export const UI_COPY = {
  viewDetails: "View Details",
  playGame: "Play Game",
  simulateGame: "Simulate Game",
  selectPlayer: "Select",
  respin: "Respin",
  continue: "Continue",
  confirm: "Confirm",
  cancel: "Cancel",
  filters: "Filters",
  boostedFirstPick: "Boosted First Pick",
  randomValidPosition: (position: string) =>
    `Random valid position: ${position}`,
  currentRatingNote: "Ratings reflect this season’s performances.",
  eraRatingNote: "Ratings reflect how each player performed in that season.",
  protectFromMassRelease: "Protect from mass release",
  previewPlayers: "Preview Players",
  releaseSelected: "Release",
  autoPromote: "Auto promote",
} as const;
