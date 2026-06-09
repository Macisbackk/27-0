import { STORAGE_KEYS } from "./keys";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface UsernameValidation {
  valid: boolean;
  value?: string;
  error?: string;
}

export function validateUsername(raw: string): UsernameValidation {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { valid: false, error: "Username is required." };
  }
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "Use letters, numbers and underscores only.",
    };
  }

  return { valid: true, value: trimmed };
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEYS.username);
  if (!stored) return null;
  const validation = validateUsername(stored);
  return validation.valid ? validation.value! : null;
}

export function hasUsername(): boolean {
  return getUsername() !== null;
}

export function setUsername(name: string): UsernameValidation {
  const validation = validateUsername(name);
  if (!validation.valid || !validation.value) {
    return validation;
  }
  localStorage.setItem(STORAGE_KEYS.username, validation.value);
  return { valid: true, value: validation.value };
}

export function clearUsername(): void {
  localStorage.removeItem(STORAGE_KEYS.username);
}
