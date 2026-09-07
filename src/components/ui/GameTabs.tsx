"use client";

import { SubTabBar, type SubTabOption } from "@/components/ui/SubTabBar";

interface GameTabsProps<T extends string> {
  tabs: readonly SubTabOption<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
  scrollable?: boolean;
  eraAccent?: boolean;
  hardAccent?: boolean;
}

/** Site-wide segmented tabs. */
export function GameTabs<T extends string>(props: GameTabsProps<T>) {
  return <SubTabBar {...props} />;
}
