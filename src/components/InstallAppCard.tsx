"use client";

import { useEffect, useState } from "react";
import { useInstallMode } from "@/lib/pwa/install";
import { playUiClick } from "@/lib/sound";

const DISMISS_KEY = "27-0-install-card-dismissed";

/** "Get the app" card: one-tap install on Android/desktop Chrome, Share-sheet steps on iPhone. */
export function InstallAppCard({ dismissible = false }: { dismissible?: boolean }) {
  const { mode, install } = useInstallMode();
  const [dismissed, setDismissed] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    try {
      setDismissed(dismissible && localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissible]);

  if (mode === "none" || dismissed) return null;

  return (
    <section aria-label="Get the app" className="rounded-[20px] bg-pitch-900 p-4 text-center">
      <p className="text-[15px] font-bold text-white">Get the 27-0 app</p>
      <p className="mx-auto mt-1 max-w-xs text-[13px] text-[color:var(--fl-muted)]">
        Add it to your home screen: opens full screen and works offline.
      </p>
      {mode === "prompt" ? (
        <button
          type="button"
          onClick={() => {
            playUiClick();
            void install();
          }}
          className="btn-press mx-auto mt-3 flex h-11 w-full max-w-[240px] items-center justify-center rounded-[14px] bg-theme-primary text-sm font-bold text-[color:var(--theme-text-on-primary)]"
        >
          Install app
        </button>
      ) : showSteps ? (
        <ol className="mx-auto mt-3 max-w-xs space-y-1.5 text-left text-[13px] text-white">
          <li>
            1. Tap the <strong>Share</strong> button{" "}
            <svg className="inline-block align-[-3px]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>{" "}
            in Safari
          </li>
          <li>
            2. Choose <strong>Add to Home Screen</strong>
          </li>
          <li>
            3. Tap <strong>Add</strong>
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setShowSteps(true);
          }}
          className="btn-press mx-auto mt-3 flex h-11 w-full max-w-[240px] items-center justify-center rounded-[14px] bg-theme-primary text-sm font-bold text-[color:var(--theme-text-on-primary)]"
        >
          Show me how
        </button>
      )}
      {dismissible ? (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="mx-auto mt-2 flex min-h-[44px] items-center px-3 text-xs font-semibold text-[color:var(--fl-muted)] hover:text-white"
        >
          Not now
        </button>
      ) : null}
    </section>
  );
}
