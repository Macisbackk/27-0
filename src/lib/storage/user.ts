import { STORAGE_KEYS } from "./keys";

const DEFAULT_USERNAME = "Player";

export function getUsername(): string {
  if (typeof window === "undefined") return DEFAULT_USERNAME;
  return localStorage.getItem(STORAGE_KEYS.username) ?? DEFAULT_USERNAME;
}

export function setUsername(name: string): void {
  const trimmed = name.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
  if (trimmed.length < 2) return;
  localStorage.setItem(STORAGE_KEYS.username, trimmed);
}

export function hasUsername(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(STORAGE_KEYS.username);
}
