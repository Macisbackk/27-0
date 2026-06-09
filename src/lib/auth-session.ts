/** In-memory auth cache for sync storage modules (leaderboard, stats). */

let cachedUserId: string | null = null;
let cachedCoachName: string | null = null;
let cachedEmail: string | null = null;

export function setAuthCache(
  userId: string | null,
  coachName: string | null,
  email: string | null
): void {
  cachedUserId = userId;
  cachedCoachName = coachName;
  cachedEmail = email;
}

export function getAuthUserId(): string | null {
  return cachedUserId;
}

export function getCachedCoachName(): string | null {
  return cachedCoachName;
}

export function getCachedEmail(): string | null {
  return cachedEmail;
}

export function isLoggedIn(): boolean {
  return cachedUserId !== null;
}
