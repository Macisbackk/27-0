"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/pwa/install";

/** Registers the service worker (website only, not the Android/iOS app shell) and keeps the install prompt. */
export function PwaSetup() {
  useEffect(() => {
    const stop = captureInstallPrompt();
    const native = document.documentElement.classList.contains("capacitor-native") || window.location.origin === "https://localhost";
    if (process.env.NODE_ENV === "production" && !native && "serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
    return stop;
  }, []);
  return null;
}
