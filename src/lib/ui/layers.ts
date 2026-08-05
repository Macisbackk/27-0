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

/**
 * Static class per layer, defined in globals.css against the --z-* vars.
 * Never build these as Tailwind arbitrary values (`z-[9999]`): the class name
 * only exists if it appears literally in a scanned file, so a generated one
 * silently leaves the element at `z-index: auto`.
 */
const UI_LAYER_CLASSES: Record<UiLayer, string> = {
  page: "ui-layer-page",
  stickyNav: "ui-layer-sticky-nav",
  mobileActionBar: "ui-layer-mobile-action-bar",
  stickyFooter: "ui-layer-sticky-footer",
  popover: "ui-layer-popover",
  sidebar: "ui-layer-sidebar",
  modalBackdrop: "ui-layer-modal-backdrop",
  modal: "ui-layer-modal",
  criticalAnimation: "ui-layer-critical-animation",
};

export function uiLayerClass(layer: UiLayer): string {
  return UI_LAYER_CLASSES[layer];
}

/** Inline style helper when class names are impractical. */
export function uiLayerStyle(layer: UiLayer): { zIndex: number } {
  return { zIndex: UI_LAYERS[layer] };
}
