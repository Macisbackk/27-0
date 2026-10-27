"use client";

import { useEffect, useLayoutEffect } from "react";
import { applyUiThemeById } from "@/lib/ui/apply-ui-theme";
import {
  getSelectedUiThemeId,
  UI_THEME_CHANGED_EVENT,
} from "@/lib/storage/ui-theme-store";
import { useMountDiagnostic } from "@/lib/ui/use-mount-diagnostic";
import { applyDarkModeAttribute, readLocalDarkModePref } from "@/lib/ui/dark-mode";
import { STORAGE_KEYS } from "@/lib/storage/keys";

const useThemeLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Applies selected store theme CSS variables (and the dark-mode attribute) on load and on change. */
export function UiThemeProvider() {
  useMountDiagnostic("UiThemeProvider");

  useThemeLayoutEffect(() => {
    applyUiThemeById(getSelectedUiThemeId());

    const onThemeChange = () => {
      applyUiThemeById(getSelectedUiThemeId());
    };

    // Dark mode: the <head> script already set data-mode before paint; this keeps it right after
    // navigation and when another tab changes it.
    applyDarkModeAttribute(readLocalDarkModePref()?.on === true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.darkMode) applyDarkModeAttribute(readLocalDarkModePref()?.on === true);
    };

    window.addEventListener(UI_THEME_CHANGED_EVENT, onThemeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UI_THEME_CHANGED_EVENT, onThemeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
