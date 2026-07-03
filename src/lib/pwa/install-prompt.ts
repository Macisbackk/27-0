const SESSION_COUNT_KEY = "27-0-session-count";
const INSTALL_DISMISSED_KEY = "27-0-pwa-install-dismissed";
const INSTALL_PROMPTED_KEY = "27-0-pwa-install-prompted";
const MIN_SESSIONS_BEFORE_PROMPT = 3;

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function recordAppSession(): number {
  if (typeof window === "undefined") return 0;
  const next = (Number(localStorage.getItem(SESSION_COUNT_KEY)) || 0) + 1;
  localStorage.setItem(SESSION_COUNT_KEY, String(next));
  return next;
}

export function getAppSessionCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(SESSION_COUNT_KEY)) || 0;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function wasInstallPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
}

export function markInstallPromptDismissed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
}

export function markInstallPromptShown(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INSTALL_PROMPTED_KEY, "1");
}

export function wasInstallPromptShown(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(INSTALL_PROMPTED_KEY) === "1";
}

export function shouldOfferInstallPrompt(sessionCount: number): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplay()) return false;
  if (wasInstallPromptDismissed()) return false;
  if (wasInstallPromptShown()) return false;
  return sessionCount >= MIN_SESSIONS_BEFORE_PROMPT;
}

export function isBeforeInstallPromptEvent(
  event: Event
): event is BeforeInstallPromptEvent {
  return "prompt" in event && typeof (event as BeforeInstallPromptEvent).prompt === "function";
}
