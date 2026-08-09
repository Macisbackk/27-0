import type { ReactNode } from "react";

interface GameSectionHeaderProps {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  /**
   * `page` — true screen title (larger).
   * `section` — default denser in-page heading (mobile-friendly).
   */
  size?: "page" | "section";
  /** Clamp long subtitles on phones. */
  collapseSubtitleOnMobile?: boolean;
}

/** Uppercase matchday micro-label + punchy page/section title. */
export function GameSectionHeader({
  label,
  title,
  subtitle,
  action,
  className = "",
  size = "section",
  collapseSubtitleOnMobile = true,
}: GameSectionHeaderProps) {
  const sizeClass =
    size === "page" ? "game-section-header--page" : "game-section-header--section";
  const subtitleClass = [
    "game-section-header__subtitle",
    "mt-1.5",
    collapseSubtitleOnMobile ? "game-section-header__subtitle--collapse sm:line-clamp-none" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={`game-section-header ${sizeClass} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="game-section-header__label">{label}</p>
          <h2 className="game-section-header__title">{title}</h2>
          {subtitle ? <div className={subtitleClass}>{subtitle}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
