/** Approximate hex values for UI panel backgrounds (WCAG text contrast targets). */
export const UI_SURFACES = {
  resultRow: "#121a17",
  resultRowSelected: "#1a2e24",
  matchDetails: "#0f1814",
  bracketRow: "#121a17",
  bracketWinner: "#1a2e24",
} as const;

export type UiSurface = keyof typeof UI_SURFACES;
