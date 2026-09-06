"use client";

import { playUiClick } from "@/lib/sound";

export function MobileAppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="m-app-header sm:hidden" data-manager-mobile-header>
      <div className="m-app-header__side">
        {showBack ? (
          <button
            type="button"
            className="m-app-header__btn"
            aria-label="Back"
            onClick={() => {
              playUiClick();
              onBack?.();
            }}
          >
            ←
          </button>
        ) : null}
      </div>
      <div className="min-w-0">
        <h1 className="m-app-header__title">{title}</h1>
        {subtitle ? <span className="m-app-header__sub">{subtitle}</span> : null}
      </div>
      <div className="m-app-header__side">{right}</div>
    </header>
  );
}
