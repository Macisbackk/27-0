"use client";

import { useEffect, useState } from "react";

/** Chrome / Edge / Samsung Internet's install event (not in the TS DOM lib yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Called once from PwaSetup: keep Chrome's install prompt so a button can show it later. */
export function captureInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    installed = true;
    deferred = null;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

export function isRunningAsApp(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    nav.standalone === true ||
    document.documentElement.classList.contains("capacitor-native")
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export type InstallMode = "prompt" | "ios" | "none";

/** How this browser can install 27-0: a real prompt (Android/desktop Chrome), iOS Share-sheet steps, or not at all. */
export function useInstallMode(): { mode: InstallMode; install: () => Promise<boolean> } {
  const [mode, setMode] = useState<InstallMode>("none");
  useEffect(() => {
    const read = () => {
      if (installed || isRunningAsApp()) setMode("none");
      else if (deferred) setMode("prompt");
      else if (isIosSafari()) setMode("ios");
      else setMode("none");
    };
    read();
    listeners.add(read);
    return () => {
      listeners.delete(read);
    };
  }, []);
  const install = async () => {
    if (!deferred) return false;
    const evt = deferred;
    deferred = null;
    await evt.prompt();
    const { outcome } = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    notify();
    return outcome === "accepted";
  };
  return { mode, install };
}
