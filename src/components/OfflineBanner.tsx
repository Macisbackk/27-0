"use client";

import { useEffect, useState } from "react";

/**
 * App only: a slim banner while the phone has no connection. The game itself is bundled in the
 * app and keeps working offline; only logging in, leaderboards and cloud saves need the network.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("27-0-app-resume", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("27-0-app-resume", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="offline-banner fixed inset-x-0 top-0 z-[80] bg-amber-500 px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-center text-[13px] font-semibold text-black"
    >
      You&rsquo;re offline. Keep playing. We&rsquo;ll sync when you&rsquo;re back.
    </div>
  );
}
