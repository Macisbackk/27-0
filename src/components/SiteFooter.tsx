import { FooterSupportLinks } from "./FooterSupportLinks";

const DISCLAIMER =
  "27-0 is an unofficial fan-made rugby league squad-building game. It is not affiliated with, endorsed by, sponsored by, or connected to the Rugby Football League, Super League, RL Commercial, any rugby league club, broadcaster, player, or governing body. All names, clubs, and references are used for fan entertainment purposes only.";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-pitch-700/40 bg-pitch-950/80 px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <FooterSupportLinks />
        <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-500 sm:text-xs">
          {DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
