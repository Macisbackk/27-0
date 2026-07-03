"use client";

import { useCallback, useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  getAppSessionCount,
  isBeforeInstallPromptEvent,
  markInstallPromptDismissed,
  markInstallPromptShown,
  recordAppSession,
  shouldOfferInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/install-prompt";
import { playUiClick } from "@/lib/sound";

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const sessions = recordAppSession();

    const onBeforeInstall = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferred(event);
      if (shouldOfferInstallPrompt(sessions)) {
        setVisible(true);
        markInstallPromptShown();
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!deferred) return;
    if (shouldOfferInstallPrompt(getAppSessionCount())) {
      setVisible(true);
      markInstallPromptShown();
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    playUiClick();
    markInstallPromptDismissed();
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    playUiClick();
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setInstalling(false);
      setVisible(false);
      setDeferred(null);
    }
  }, [deferred]);

  if (!visible || !deferred) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:px-0"
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-body"
    >
      <div className={`${CARD.elevated} ${SPACING.cardPadding} shadow-2xl`}>
        <p id="pwa-install-title" className={TYPO.sectionLabel}>
          Install 27-0
        </p>
        <p id="pwa-install-body" className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
          Add 27-0 to your home screen for quick access to Manager Mode and your
          saves — works offline once installed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <GameButton
            variant="theme"
            size="sm"
            disabled={installing}
            onClick={install}
          >
            {installing ? "Installing…" : "Install app"}
          </GameButton>
          <GameButton variant="secondary" size="sm" onClick={dismiss}>
            Not now
          </GameButton>
        </div>
      </div>
    </div>
  );
}
