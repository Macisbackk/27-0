"use client";

import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import type { ManagerSubTabOption } from "@/components/manager/ManagerSubTabBar";

interface GameTabsProps<T extends string> {
  tabs: readonly ManagerSubTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  scrollable?: boolean;
  eraAccent?: boolean;
  hardAccent?: boolean;
}

/** Site-wide segmented tabs — same control as Manager Mode. */
export function GameTabs<T extends string>(props: GameTabsProps<T>) {
  return <ManagerSubTabBar {...props} />;
}
