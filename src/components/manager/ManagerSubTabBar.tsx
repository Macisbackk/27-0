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
}

interface ManagerSubTabBarProps<T extends string> {
  tabs: readonly ManagerSubTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Centered segmented sub-tabs for manager pages — always use this instead of TAB_RAIL. */
export function ManagerSubTabBar<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: ManagerSubTabBarProps<T>) {
  return (
    <div className={SUB_TAB_BAR_SHELL}>
      <div
        className={`${subTabGroupClass()} ${className ?? ""}`}
        role="tablist"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={subTabGroupButtonClass(active === id)}
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
