"use client";

import React, { useState } from "react";
import { useManager, type ManagerTab } from "@/lib/manager/context";
import { MobileBottomSheet } from "@/components/ui/MobileOverlay";

type PrimaryId = "dashboard" | "squad" | "tactics" | "fixtures";

const PRIMARY: { id: PrimaryId; label: string; icon: React.ReactNode }[] = [
  {
    id: "dashboard",
    label: "Hub",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    id: "squad",
    label: "Squad",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "tactics",
    label: "Tactics",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: "fixtures",
    label: "Fixtures",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const MORE_ITEMS: { id: ManagerTab; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "transfers", label: "Transfers" },
  { id: "loans", label: "Loans" },
  { id: "contracts", label: "Contracts" },
  { id: "training", label: "Training" },
  { id: "league", label: "League" },
  { id: "club", label: "Club & Finances" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export function ManagerMobileBottomNav() {
  const { state, activeTab, setActiveTab } = useManager();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!state) return null;

  const unreadCount = state.inbox.unreadCount;
  const pendingBids = state.transfers.activeBids.filter(
    (b) => b.toClubId === state.manager.clubId && b.status === "pending_club"
  ).length;
  const moreActive = MORE_ITEMS.some((item) => item.id === activeTab);

  const badgeFor = (id: ManagerTab) => {
    if (id === "inbox") return unreadCount;
    if (id === "transfers") return pendingBids;
    return 0;
  };

  return (
    <>
      <nav
        data-manager-mobile-nav
        className="fixed inset-x-0 bottom-0 z-40 ui-layer-sticky-footer sm:hidden border-t border-pitch-800 bg-pitch-950 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Manager navigation"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 pt-1.5 pb-1">
          {PRIMARY.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${
                  active ? "text-emerald-300" : "text-pitch-400"
                }`}
              >
                <span className={active ? "text-emerald-400" : "text-pitch-500"}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${
              moreActive || moreOpen ? "text-emerald-300" : "text-pitch-400"
            }`}
          >
            <span className={moreActive || moreOpen ? "text-emerald-400" : "text-pitch-500"}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </span>
            More
            {unreadCount + pendingBids > 0 && (
              <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount + pendingBids}
              </span>
            )}
          </button>
        </div>
      </nav>

      <MobileBottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        className="sm:hidden"
      >
        <div data-manager-more-sheet className="flex flex-col divide-y divide-pitch-800">
          {MORE_ITEMS.map((item) => {
            const badge = badgeFor(item.id);
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMoreOpen(false);
                }}
                className={`flex w-full items-center justify-between px-1 py-3.5 text-left text-sm font-semibold ${
                  active ? "text-emerald-300" : "text-white"
                }`}
              >
                <span>{item.label}</span>
                {badge > 0 ? (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
    </>
  );
}
