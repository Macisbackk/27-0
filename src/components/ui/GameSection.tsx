import type { ReactNode } from "react";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";

interface GameSectionProps {
  children: ReactNode;
  title?: ReactNode;
  label?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Section wrapper with optional GameSectionHeader. */
export function GameSection({
  children,
  title,
  label = "Section",
  subtitle,
  action,
  className = "",
}: GameSectionProps) {
  return (
    <section className={`space-y-3 ${className}`.trim()}>
      {title != null ? (
        <GameSectionHeader
          label={label}
          title={title}
          subtitle={subtitle}
          action={action}
        />
      ) : null}
      {children}
    </section>
  );
}
