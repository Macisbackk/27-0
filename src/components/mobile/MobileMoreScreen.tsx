"use client";

import {
  MANAGER_MOBILE_MORE_GROUPS,
  type ManagerMoreItem,
} from "@/lib/manager/manager-mobile-more";
import type { ManagerTutorialNavLock } from "@/lib/manager/managerTutorial";
import type { ManagerView } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import {
  MobileList,
  MobileListRow,
  MobileScreen,
  MobileSection,
} from "@/components/mobile/MobileKit";

interface MobileMoreScreenProps {
  active: ManagerView;
  unreadInbox?: number;
  tutorialLock?: ManagerTutorialNavLock;
  onNavigate: (view: ManagerView) => void;
  onOpenCup: () => void;
  onOpenPlayoffs: () => void;
  onNavigateHref: (href: string) => void;
}

export function MobileMoreScreen({
  active,
  unreadInbox = 0,
  tutorialLock = null,
  onNavigate,
  onOpenCup,
  onOpenPlayoffs,
  onNavigateHref,
}: MobileMoreScreenProps) {
  const lockedOut = (id: string) => {
    if (!tutorialLock) return false;
    return tutorialLock !== id && tutorialLock !== "more";
  };

  const handleItem = (item: ManagerMoreItem) => {
    playUiClick();
    if (item.kind === "view") {
      if (lockedOut(item.id)) return;
      onNavigate(item.id);
      return;
    }
    if (item.kind === "href") {
      onNavigateHref(item.href);
      return;
    }
    if (item.action === "cup") onOpenCup();
    else onOpenPlayoffs();
  };

  return (
    <MobileScreen
      data-manager-more-screen=""
      data-manager-more-sheet=""
    >
      {MANAGER_MOBILE_MORE_GROUPS.map((group) => (
        <MobileSection key={group.title} label={group.title}>
          <MobileList>
            {group.items.map((item) => {
              const selected =
                item.kind === "view" && item.id === active;
              const tutorialTarget =
                item.kind === "view" ? item.tutorialTarget : undefined;
              const disabled =
                item.kind === "view" ? lockedOut(item.id) : Boolean(tutorialLock);
              const value =
                item.kind === "view" && item.id === "inbox" && unreadInbox > 0
                  ? unreadInbox > 9
                    ? "9+"
                    : String(unreadInbox)
                  : undefined;
              return (
                <MobileListRow
                  key={item.kind === "view" ? item.id : item.kind === "href" ? item.href : item.action}
                  primary={item.label}
                  value={value}
                  chevron
                  selected={selected}
                  disabled={disabled}
                  tutorialTarget={tutorialTarget}
                  onClick={() => handleItem(item)}
                />
              );
            })}
          </MobileList>
        </MobileSection>
      ))}
    </MobileScreen>
  );
}
