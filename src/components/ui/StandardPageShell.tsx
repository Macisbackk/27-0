import type { ReactNode } from "react";
import { PageShell, type PageShellWidth } from "@/components/ui/PageShell";
import { PAGE } from "@/lib/ui/design-system";

interface StandardPageShellProps {
  children: ReactNode;
  /** Outer shell width — default matches Manager Mode (1180px). */
  width?: Exclude<PageShellWidth, "full">;
  withLights?: boolean;
  desktopFit?: boolean;
  compact?: boolean;
  className?: string;
  /**
   * When true, wrap children in the Manager Transfers content column (980px).
   * Default true so Store / Leaderboard / Showcase align with Manager sections.
   */
  contentColumn?: boolean;
}

/**
 * Shared site page shell — Manager Mode outer width + Transfers content column.
 * Do not add page-specific max-width overrides; use `contentColumn={false}` only
 * for genuine breakouts (wide brackets / tables) inside the shell.
 */
export function StandardPageShell({
  children,
  width = "default",
  withLights = true,
  desktopFit = false,
  compact = true,
  className = "",
  contentColumn = true,
}: StandardPageShellProps) {
  return (
    <PageShell
      width={width}
      withLights={withLights}
      desktopFit={desktopFit}
      compact={compact}
      className={className}
    >
      {contentColumn ? (
        <div className={`${PAGE.content} w-full min-w-0`}>{children}</div>
      ) : (
        children
      )}
    </PageShell>
  );
}
