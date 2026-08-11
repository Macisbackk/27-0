"use client";

import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import {
  SUB_TAB_BAR_SHELL,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { playTabChange } from "@/lib/sound";

export interface ManagerSubTabOption<T extends string> {
  id: T;
  label: string;
  /** Shorter label on narrow screens when many tabs share one row. */
  shortLabel?: string;
  /** Tooltip / accessible full name when the visible label is abbreviated. */
  title?: string;
  variant?: "normal" | "current" | "hard" | "era" | "gold";
}

interface ManagerSubTabBarProps<T extends string> {
  tabs: readonly ManagerSubTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  /** Horizontal scroll when many tabs (e.g. fixture filters). */
  scrollable?: boolean;
  eraAccent?: boolean;
  hardAccent?: boolean;
}

/**
 * Centered segmented sub-tabs.
 * Two/three options use compact GameSegmentedControl; many tabs keep the scroll bar.
 */
export function ManagerSubTabBar<T extends string>({
  tabs,
  active,
  onChange,
  className,
  ariaLabel,
  scrollable = false,
  eraAccent = false,
  hardAccent = false,
}: ManagerSubTabBarProps<T>) {
  const useCompactToggle = !scrollable && tabs.length <= 3 && !hardAccent;
  // Enough tabs that equal flex would clip labels — use intentional horizontal scroll.
  const useScrollRail = scrollable || tabs.length >= 5;

  if (useCompactToggle) {
    return (
      <GameSegmentedControl
        className={className}
        ariaLabel={ariaLabel}
        value={active}
        onChange={onChange}
        options={tabs.map((t) => ({
          id: t.id,
          label: t.label,
          shortLabel: t.shortLabel,
          tone:
            t.variant === "era"
              ? "era"
              : t.variant === "current"
                ? "current"
                : "default",
        }))}
      />
    );
  }

  const shellClass = useScrollRail
    ? "flex w-full justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : SUB_TAB_BAR_SHELL;

  const groupClass = `${tabGroupClass(hardAccent, false, eraAccent)}${
    useScrollRail
      ? " min-w-max w-max max-w-none"
      : " w-full max-w-full"
  } ${className ?? ""}`.trim();

  const buttonLayout = useScrollRail ? "scroll" : "equal";

  return (
    <div className={shellClass}>
      <div className={groupClass} role="tablist" aria-label={ariaLabel}>
        {tabs.map(({ id, label, shortLabel, title, variant = "normal" }) => {
          // Scroll rails pack many chips — prefer short labels so long names (WCC) fit.
          const compactLabel = shortLabel ?? label;
          const desktopLabel =
            useScrollRail && shortLabel ? shortLabel : label;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              title={title ?? label}
              className={tabGroupButtonClass(
                active === id,
                variant,
                buttonLayout
              )}
              onClick={() => {
                if (active === id) return;
                playTabChange();
                onChange(id);
              }}
            >
              {shortLabel && !useScrollRail ? (
                <>
                  <span className="whitespace-nowrap text-center leading-tight sm:hidden">
                    {compactLabel}
                  </span>
                  <span className="hidden whitespace-nowrap text-center leading-tight sm:inline">
                    {desktopLabel}
                  </span>
                </>
              ) : (
                <span className="whitespace-nowrap text-center leading-tight">
                  {desktopLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
