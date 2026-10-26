"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

/**
 * In the iPhone / Android app, open http(s) links that leave 27-0 in the in-app browser
 * (SFSafariViewController on iPhone, Custom Tabs on Android), so there is never browser chrome in the app itself.
 * Internal routes stay inside the WebView.
 */
export function ExternalLinkGuard() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:")) {
        return;
      }
      if (!/^https?:\/\//i.test(href)) return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) return;
      } catch {
        return;
      }

      event.preventDefault();
      void Browser.open({ url: href });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
