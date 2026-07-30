"use client";

import { usePathname } from "next/navigation";
import { FooterSupportLinks } from "./FooterSupportLinks";
import { TYPO } from "@/lib/ui/typography";

const DISCLAIMER =
  "27-0 is an unofficial fan-made rugby league squad-building game. It is not affiliated with, endorsed by, sponsored by, or connected to the Rugby Football League, Super League, RL Commercial, any rugby league club, broadcaster, player, or governing body. All names, clubs, and references are used for fan entertainment purposes only.";

const MINIMAL_CHROME_PATHS = ["/login", "/auth/reset-password", "/auth/callback"];

export function SiteFooter() {
  const pathname = usePathname();
  const minimalChrome = MINIMAL_CHROME_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (minimalChrome) {
    return (
      <footer className="site-footer relative mt-auto shrink-0 border-t border-pitch-700/45 bg-pitch-950 px-4 py-3">
        <p className={`text-center break-words ${TYPO.bodySm}`}>{DISCLAIMER}</p>
      </footer>
    );
  }

  const hideOnMobileManager = pathname.startsWith("/manager");

  return (
    <footer
      className={`site-footer relative mt-auto shrink-0 border-t border-pitch-700/45 bg-pitch-950 px-4 py-5 ${
        hideOnMobileManager ? "hidden sm:block" : ""
      }`}
    >
      <div className="game-page game-page--flush">
        <FooterSupportLinks />
        <p className={`mt-4 text-center break-words ${TYPO.bodySm}`}>{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
