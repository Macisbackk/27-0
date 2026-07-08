"use client";

import {
  SUB_TAB_BAR_SHELL,
  subTabGroupButtonClass,
  subTabGroupClass,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { playTabChange, playUiClick } from "@/lib/sound";

export interface ManagerSubTabOption<T extends string> {
  id: T;
  label: string;
  /** Shorter label on narrow screens when many tabs share one row. */
  shortLabel?: string;
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

/** Centered segmented sub-tabs — use site-wide for consistent nav styling. */
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
  const compactGroup = scrollable;
  const shellClass = scrollable
    ? "flex w-full justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : SUB_TAB_BAR_SHELL;

  const groupClass = compactGroup
    ? `${subTabGroupClass(hardAccent, false, eraAccent)} min-w-max w-max max-w-none ${className ?? ""}`
    : `${tabGroupClass(hardAccent, false, eraAccent)} ${className ?? ""}`;

  return (
    <div className={shellClass}>
      <div className={groupClass} role="tablist" aria-label={ariaLabel}>
        {tabs.map(({ id, label, shortLabel, variant = "normal" }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            title={label}
            className={
              compactGroup
                ? subTabGroupButtonClass(active === id, variant, true)
                : tabGroupButtonClass(active === id, variant)
            }
            onClick={() => {
              if (active === id) return;
              playTabChange();
              playUiClick();
              onChange(id);
            }}
          >
            {shortLabel ? (
              <>
                <span className="truncate sm:hidden">{shortLabel}</span>
                <span className="hidden truncate sm:inline">{label}</span>
              </>
            ) : (
              <span className="truncate">{label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
