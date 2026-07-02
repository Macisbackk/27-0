import type { ReactNode } from "react";
import { SPACING } from "@/lib/ui/design-system";

export type PageShellWidth = "default" | "wide" | "full";

interface PageShellProps {
  children: ReactNode;
  /** Content max-width — matches home (4xl) or play (6xl). */
  width?: PageShellWidth;
  className?: string;
  innerClassName?: string;
  /** Stadium floodlight overlay (play / manager). */
  withLights?: boolean;
  /** On lg+, constrain to viewport below header/footer. */
  desktopFit?: boolean;
  /** Tighter vertical padding on desktop. */
  compact?: boolean;
}

const WIDTH_CLASS: Record<PageShellWidth, string> = {
  default: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-[min(100%,90rem)]",
};

export function PageShell({
  children,
  width = "default",
  className = "",
  innerClassName = "",
  withLights = false,
  desktopFit = false,
  compact = false,
}: PageShellProps) {
  const padY = compact
    ? "py-5 sm:py-6 lg:py-4"
    : "py-8 sm:py-10 lg:py-8";

  return (
    <div
      className={`matchday-arena arena-surface relative flex min-h-full flex-1 flex-col ${desktopFit ? "lg:desktop-page-fit" : ""} ${className}`}
    >
      <div
        className="stadium-backdrop pointer-events-none fixed inset-0"
        aria-hidden
      />
      {withLights && (
        <div
          className="stadium-lights pointer-events-none fixed inset-0"
          aria-hidden
        />
      )}
      <div
        className={`relative mx-auto flex w-full flex-col ${WIDTH_CLASS[width]} ${SPACING.pageX} ${padY} ${desktopFit ? "lg:min-h-0 lg:flex-1" : ""} ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Scrollable main column inside a desktop-fit page (scrollbar hidden on lg+). */
export function PageShellBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${className} lg:desktop-scroll-rail lg:overflow-y-auto lg:overscroll-contain`}
    >
      {children}
    </div>
  );
}
