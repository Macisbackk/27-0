import type { ReactNode } from "react";

interface GameSectionHeaderProps {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Uppercase matchday micro-label + punchy page/section title. */
export function GameSectionHeader({
  label,
  title,
  subtitle,
  action,
  className = "",
}: GameSectionHeaderProps) {
  return (
    <header className={`game-section-header ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="game-section-header__label">{label}</p>
          <h2 className="game-section-header__title">{title}</h2>
          {subtitle ? (
            <div className="game-section-header__subtitle mt-1">{subtitle}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
