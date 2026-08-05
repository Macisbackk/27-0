import type { ReactNode } from "react";

interface GameShortContentProps {
  children: ReactNode;
  className?: string;
  /** Narrower centred column for badges / single-line status. */
  narrow?: boolean;
}

/** Centred short copy — WIP badges, compact summaries, modal intros. */
export function GameShortContent({
  children,
  className = "",
  narrow = false,
}: GameShortContentProps) {
  return (
    <div
      className={`mx-auto w-full text-center ${narrow ? "max-w-md" : "max-w-2xl"} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
