"use client";

import {
  SUB_TAB_BAR_SHELL,
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

/** Centered segmented sub-tabs — one shared style across Manager Mode. */
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
    ? "flex w-full justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : SUB_TAB_BAR_SHELL;

  const groupClass = `${tabGroupClass(hardAccent, false, eraAccent)}${
    scrollable
      ? " min-w-max w-max max-w-none"
      : " w-full max-w-md sm:w-auto sm:min-w-[18rem]"
  } ${className ?? ""}`.trim();

  const buttonLayout = scrollable ? "scroll" : "equal";

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
            className={tabGroupButtonClass(
              active === id,
              variant,
              buttonLayout
            )}
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
