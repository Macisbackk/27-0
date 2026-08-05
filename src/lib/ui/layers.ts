/**
 * Central z-index scale — overlays must sit above sticky nav/footer (50) and
 * mobile action bars (40). Prefer CSS vars in stylesheets; use these in TS/JSX.
 */
export const UI_LAYERS = {
  page: 0,
  stickyNav: 30,
  mobileActionBar: 40,
  stickyFooter: 50,
  popover: 60,
  sidebar: 70,
  modalBackdrop: 9999,
  modal: 10000,
  criticalAnimation: 10001,
} as const;

export type UiLayer = keyof typeof UI_LAYERS;

/** Tailwind arbitrary z-index class for a named layer. */
export function uiLayerClass(layer: UiLayer): string {
  return `z-[${UI_LAYERS[layer]}]`;
}

/** Inline style helper when class names are impractical. */
export function uiLayerStyle(layer: UiLayer): { zIndex: number } {
  return { zIndex: UI_LAYERS[layer] };
}
