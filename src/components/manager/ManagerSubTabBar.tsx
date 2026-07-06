"use client";

import {
  SUB_TAB_BAR_SHELL,
  subTabGroupButtonClass,
  subTabGroupClass,
} from "@/lib/ui/design-system";
import { playTabChange, playUiClick } from "@/lib/sound";

export interface ManagerSubTabOption<T extends string> {
  id: T;
  label: string;
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

/** Full-width segmented sub-tabs — use site-wide for consistent nav styling. */
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
  const shellClass = scrollable
    ? `${SUB_TAB_BAR_SHELL} overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
    : SUB_TAB_BAR_SHELL;

  const groupClass = `${subTabGroupClass(hardAccent, false, eraAccent)}${
    scrollable ? " min-w-max" : ""
  } ${className ?? ""}`;

  return (
    <div className={shellClass}>
      <div className={groupClass} role="tablist" aria-label={ariaLabel}>
        {tabs.map(({ id, label, variant = "normal" }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={`${subTabGroupButtonClass(active === id, variant)}${
              scrollable ? " shrink-0 whitespace-nowrap !flex-none px-3 sm:px-4" : ""
            }`}
            onClick={() => {
              if (active === id) return;
              playTabChange();
              playUiClick();
              onChange(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
