"use client";

import React from "react";
import { useManager, type ManagerTab } from "@/lib/manager/context";

interface NavItem {
  id: ManagerTab;
  label: string;
  badge?: number;
}

export function ManagerNav() {
  const { activeTab, setActiveTab, state } = useManager();

  if (!state) return null;

  const unreadCount = state.inbox.unreadCount;
  const pendingBidsCount = state.transfers.activeBids.filter(
    (b) => b.toClubId === state.manager.clubId && b.status === "pending_club"
  ).length;

  const NAV_ITEMS: NavItem[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "inbox", label: "Inbox", badge: unreadCount },
    { id: "squad", label: "Squad" },
    { id: "tactics", label: "Tactics" },
    { id: "transfers", label: "Transfers", badge: pendingBidsCount },
    { id: "loans", label: "Loans" },
    { id: "contracts", label: "Contracts" },
    { id: "training", label: "Training" },
    { id: "fixtures", label: "Fixtures" },
    { id: "league", label: "League" },
    { id: "club", label: "Club & Finances" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <nav className="border-b border-pitch-800 bg-pitch-900/90 px-2 sm:px-6 sticky top-[57px] sm:top-[65px] z-20 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-pitch-300 hover:bg-pitch-800/60 hover:text-white"
              }`}
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
