import type { ReactNode } from "react";

interface GameSectionTitleProps {
  label?: string;
  heading: ReactNode;
  className?: string;
}

/** Programme section masthead with pitch-line underline. */
export function GameSectionTitle({
  label,
  heading,
  className = "",
}: GameSectionTitleProps) {
  return (
    <div className={`game-section-title ${className}`.trim()}>
      {label ? <p className="game-section-title__label">{label}</p> : null}
      <h2 className="game-section-title__heading">{heading}</h2>
    </div>
  );
}
