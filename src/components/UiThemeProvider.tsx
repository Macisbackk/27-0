"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyUiThemeById } from "@/lib/ui/apply-ui-theme";
import {
  getSelectedUiThemeId,
  UI_THEME_CHANGED_EVENT,
} from "@/lib/storage/ui-theme-store";

const useThemeLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Applies selected store theme CSS variables on load and when the user changes theme. */
export function UiThemeProvider() {
  useThemeLayoutEffect(() => {
    applyUiThemeById(getSelectedUiThemeId());

    const onThemeChange = () => {
      applyUiThemeById(getSelectedUiThemeId());
    };

    window.addEventListener(UI_THEME_CHANGED_EVENT, onThemeChange);
    return () => window.removeEventListener(UI_THEME_CHANGED_EVENT, onThemeChange);
  }, []);

  return null;
}
