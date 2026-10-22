"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureInstallPrompt } from "@/lib/pwa/install";

function isAppShell(): boolean {
  return document.documentElement.classList.contains("capacitor-native") || window.location.origin === "https://localhost";
}

/** Registers the service worker (website only, not the Android/iOS app shell) and keeps the install prompt. */
export function PwaSetup() {
  const pathname = usePathname();

  useEffect(() => {
    const stop = captureInstallPrompt();
    if (process.env.NODE_ENV === "production" && !isAppShell() && "serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
    return stop;
  }, []);

  // Save an offline copy of each page visited, a moment after it has finished loading.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isAppShell() || !("serviceWorker" in navigator)) return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "cache-page", url: window.location.pathname + window.location.search }))
        .catch(() => {});
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
