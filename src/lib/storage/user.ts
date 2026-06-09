import { getCachedCoachName, isLoggedIn } from "../auth-session";

export const COACH_NAME_MIN_LENGTH = 3;
export const COACH_NAME_MAX_LENGTH = 16;
const COACH_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface CoachNameValidation {
  valid: boolean;
  value?: string;
  error?: string;
}

/** @deprecated Use validateCoachName */
export const USERNAME_MIN_LENGTH = COACH_NAME_MIN_LENGTH;
/** @deprecated Use validateCoachName */
export const USERNAME_MAX_LENGTH = COACH_NAME_MAX_LENGTH;

export function validateCoachName(raw: string): CoachNameValidation {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { valid: false, error: "Coach name is required." };
  }
  if (trimmed.length < COACH_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Coach name must be at least ${COACH_NAME_MIN_LENGTH} characters.`,
    };
  }
  if (trimmed.length > COACH_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Coach name must be ${COACH_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (!COACH_NAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: "Use letters, numbers and underscores only.",
    };
  }

  return { valid: true, value: trimmed };
}

/** @deprecated Use validateCoachName */
export const validateUsername = validateCoachName;

/** Logged-in coach display name from Supabase profile cache. */
export function getUsername(): string | null {
  return getCachedCoachName();
}

/** True when user is logged in with a coach name. */
export function hasUsername(): boolean {
  return isLoggedIn() && getCachedCoachName() !== null;
}
