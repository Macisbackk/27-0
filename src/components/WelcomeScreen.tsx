"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { applyEntryGate, markEntered, setWelcomeVisible } from "@/lib/entry-gate";
import { LogoMark } from "./LogoMark";

/**
 * First-visit welcome screen on "/" (see src/lib/entry-gate.ts for who sees it).
 *
 * Always in the home page's HTML but hidden by CSS (src/styles/welcome.css) unless <html> has
 * data-entry="welcome", which the pre-paint bootstrap script sets. So returning players and
 * signed-in coaches never see a flash of it, first-time visitors never see a flash of the
 * homepage, and crawlers / no-JS visitors get the homepage.
 */
export function WelcomeScreen() {
  const { loading, isLoggedIn } = useAuth();

  // Client-side navigation to "/" (no bootstrap script run): decide again before paint.
  useLayoutEffect(() => {
    applyEntryGate("/");
    return () => setWelcomeVisible(false);
  }, []);

  // A session that resolves while the screen is up (e.g. signed in on another tab).
  useEffect(() => {
    if (!loading && isLoggedIn) markEntered("account");
  }, [loading, isLoggedIn]);

  const continueAsGuest = () => {
    markEntered("guest");
    window.scrollTo(0, 0);
    // Hand focus to the homepage so keyboard / screen-reader users aren't left on a hidden button.
    const heading = document.getElementById("home-heading");
    heading?.focus({ preventScroll: true });
  };

  return (
    <section className="welcome-gate" aria-labelledby="welcome-heading">
      <div className="welcome-gate__inner">
        <h2 id="welcome-heading" className="sr-only">
          Welcome to 27-0
        </h2>
        <div className="welcome-gate__mark" aria-hidden>
          <LogoMark size="lg" />
        </div>
        <p className="welcome-gate__tagline">The game starts here.</p>
        <div className="welcome-gate__actions">
          <Link href="/login?redirect=/" className="welcome-gate__btn welcome-gate__btn--primary">
            Log in
          </Link>
          <button type="button" onClick={continueAsGuest} className="welcome-gate__btn welcome-gate__btn--quiet">
            Continue as guest
          </button>
        </div>
      </div>
    </section>
  );
}
