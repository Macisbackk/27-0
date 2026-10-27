import { STORAGE_KEYS } from "../storage/keys";

/**
 * Dark mode (Settings → Appearance): the pre-v1.23 look — black page, dark header / nav / footer,
 * one coloured pitch surface per screen (the home Classic card, a page's hero). Off by default:
 * the whole-page lime pitch stays the default.
 *
 * It's an attribute on <html> (`data-mode="dark"`), set before paint by DARK_MODE_BOOTSTRAP_SCRIPT
 * and kept in step by UiThemeProvider. src/styles/pitch-page.css scopes the whole-page pitch to
 * `html:not([data-mode="dark"])`. React never renders differently on it, so hydration is safe.
 *
 * Pure helpers only (no Supabase) so scripts/test-dark-mode.ts can import them.
 */

export const DARK_MODE_ATTRIBUTE = "data-mode";
export const DARK_MODE_CHANGED_EVENT = "27-0-dark-mode-changed";

export interface DarkModePref {
  on: boolean;
  /** ms since epoch of the last change; the newer side wins a local/cloud merge. */
  updatedAt: number;
}

/** A stored / cloud value, or null when it's missing or malformed. */
export function parseDarkModePref(raw: unknown): DarkModePref | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { on, updatedAt } = value as Partial<DarkModePref>;
  if (typeof on !== "boolean") return null;
  return { on, updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : 0 };
}

/** Last write wins; a tie keeps this device's choice; a missing side never wipes the other. */
export function mergeDarkModePref(local: DarkModePref | null, cloud: DarkModePref | null): DarkModePref | null {
  if (!cloud) return local;
  if (!local) return cloud;
  return cloud.updatedAt > local.updatedAt ? cloud : local;
}

/** Reads the local preference (false when unset, unreadable or on the server). */
export function readLocalDarkModePref(): DarkModePref | null {
  if (typeof window === "undefined") return null;
  try {
    return parseDarkModePref(localStorage.getItem(STORAGE_KEYS.darkMode));
  } catch {
    return null;
  }
}

export function writeLocalDarkModePref(pref: DarkModePref): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.darkMode, JSON.stringify(pref));
  } catch {
    // private mode / full storage: the attribute still applies for this page view
  }
}

/** Sets or clears `data-mode="dark"` on <html>. Never touches React output. */
export function applyDarkModeAttribute(on: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.setAttribute(DARK_MODE_ATTRIBUTE, "dark");
  else root.removeAttribute(DARK_MODE_ATTRIBUTE);
}

/** Inline <head> script: applies the stored preference before first paint (no lime flash). */
export const DARK_MODE_BOOTSTRAP_SCRIPT = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.darkMode,
)})||"null");if(v&&v.on===true)document.documentElement.setAttribute("${DARK_MODE_ATTRIBUTE}","dark");}catch(e){}})();`;
