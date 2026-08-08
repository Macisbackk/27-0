"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Native Android shell hooks — no-ops in the browser / Vercel build.
 * Handles status bar styling and the system Back button (close overlays first).
 */
export function CapacitorAppShell() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("capacitor-native");
    document.documentElement.classList.add(
      `capacitor-${Capacitor.getPlatform()}`
    );

    void (async () => {
      try {
        // Light icons on 27-0's dark chrome (Capacitor: Light = light content).
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#0a0f0d" });
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch {
        // Plugin may be unavailable in some debug shells.
      }
      try {
        await SplashScreen.hide();
      } catch {
        // ignore
      }
    })();

    const sub = CapApp.addListener("backButton", ({ canGoBack }) => {
      // Prefer closing an open dialog / sheet before navigating away.
      const closeBtn = document.querySelector<HTMLElement>(
        '[data-modal-close], [aria-label="Close"], [aria-label="Close dialog"], button[aria-label="Close"]'
      );
      const openDialog = document.querySelector(
        '[role="dialog"][aria-modal="true"], .mobile-bottom-sheet, .manager-modal-open'
      );
      if (openDialog && closeBtn) {
        closeBtn.click();
        return;
      }
      if (openDialog) {
        // Escape-style dismiss if a known dismiss control exists.
        const dismiss = openDialog.querySelector<HTMLElement>(
          "button[data-dismiss], button[aria-label*='Close' i], button[aria-label*='Dismiss' i]"
        );
        if (dismiss) {
          dismiss.click();
          return;
        }
      }

      if (pathname.startsWith("/play") && pathname !== "/play") {
        router.replace("/play");
        return;
      }
      if (pathname.startsWith("/manager/") && pathname !== "/manager") {
        router.replace("/manager");
        return;
      }
      if (pathname !== "/") {
        if (canGoBack) {
          router.back();
        } else {
          router.replace("/");
        }
        return;
      }

      // On home: leave the app (Android default).
      void CapApp.minimizeApp();
    });

    return () => {
      void sub.then((handle) => handle.remove());
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // App resume — do not wipe state; soft signal for listeners if needed.
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new Event("27-0-app-resume"));
      } else {
        window.dispatchEvent(new Event("27-0-app-pause"));
      }
    });
    return () => {
      void sub.then((handle) => handle.remove());
    };
  }, []);

  return null;
}
