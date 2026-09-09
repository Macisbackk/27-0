import type { ReactNode } from "react";

interface GameHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Scorebug-style page / section header — centred unless an action sits beside it. */
export function GameHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className = "",
}: GameHeaderProps) {
  return (
    <header className={`game-header ${className}`.trim()}>
      <div
        className={`flex gap-3 ${
          action ? "items-start justify-between" : "flex-col items-center"
        }`}
      >
        <div className={`min-w-0 flex-1 ${action ? "text-left" : "text-center"}`}>
          {eyebrow ? <p className="game-header__eyebrow">{eyebrow}</p> : null}
          <h1 className="game-header__title">{title}</h1>
          {subtitle ? (
            <div className="game-header__subtitle mt-1">{subtitle}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
