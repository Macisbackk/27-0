import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Light haptic feedback. In the iPhone / Android app it uses the native Taptic Engine / vibrator
 * (WKWebView has no navigator.vibrate); on the website it falls back to navigator.vibrate (Android browsers).
 */
export function triggerHaptic(pattern: number | number[] = 10): void {
  if (isNative()) {
    const ms = Array.isArray(pattern) ? Math.max(...pattern) : pattern;
    void Haptics.impact({ style: ms >= 15 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
    return;
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** App-only haptics for key moments (the website stays as it was). */
export function nativeHaptic(kind: "tap" | "impact" | "success"): void {
  if (!isNative()) return;
  const run =
    kind === "success"
      ? Haptics.notification({ type: NotificationType.Success })
      : Haptics.impact({ style: kind === "impact" ? ImpactStyle.Medium : ImpactStyle.Light });
  void run.catch(() => {});
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
