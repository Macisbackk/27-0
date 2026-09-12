"use client";

import React from "react";
import { ManagerProvider, useManager } from "@/lib/manager/context";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerHeader } from "@/components/manager/ManagerHeader";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";
import { ManagerSquadView } from "@/components/manager/ManagerSquadView";
import { ManagerTacticsView } from "@/components/manager/ManagerTacticsView";
import { ManagerTransfersView } from "@/components/manager/ManagerTransfersView";
import { ManagerLoansView } from "@/components/manager/ManagerLoansView";
import { ManagerContractsView } from "@/components/manager/ManagerContractsView";
import { ManagerTrainingView } from "@/components/manager/ManagerTrainingView";
import { ManagerFixturesView } from "@/components/manager/ManagerFixturesView";
import { ManagerLeagueView } from "@/components/manager/ManagerLeagueView";
import { ManagerClubView } from "@/components/manager/ManagerClubView";
import { ManagerInboxView } from "@/components/manager/ManagerInboxView";
import { ManagerSettingsView } from "@/components/manager/ManagerSettingsView";
import { ManagerMatchReviewModal } from "@/components/manager/ManagerMatchReviewModal";
import { ManagerSeasonAwardsModal } from "@/components/manager/ManagerSeasonAwardsModal";

function ManagerModeContent() {
  const { state, activeTab, isLoading } = useManager();

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-bold text-pitch-300">Loading Manager Mode Universe...</p>
      </div>
    );
  }

  if (!state) {
    return <ManagerClubSelect />;
  }

  return (
    <div className="min-h-screen bg-pitch-950 text-pitch-100 flex flex-col">
      {/* Sticky Top Header */}
      <ManagerHeader />

      {/* Main Tab Navigation */}
      <ManagerNav />

      {/* Main Tab Viewport */}
      <main className="flex-1 pb-16">
        {activeTab === "dashboard" && <ManagerDashboard />}
        {activeTab === "inbox" && <ManagerInboxView />}
        {activeTab === "squad" && <ManagerSquadView />}
        {activeTab === "tactics" && <ManagerTacticsView />}
        {activeTab === "transfers" && <ManagerTransfersView />}
        {activeTab === "loans" && <ManagerLoansView />}
        {activeTab === "contracts" && <ManagerContractsView />}
        {activeTab === "training" && <ManagerTrainingView />}
        {activeTab === "fixtures" && <ManagerFixturesView />}
        {activeTab === "league" && <ManagerLeagueView />}
        {activeTab === "club" && <ManagerClubView />}
        {activeTab === "settings" && <ManagerSettingsView />}
      </main>

      {/* Modals */}
      <ManagerMatchReviewModal />
      <ManagerSeasonAwardsModal />
    </div>
  );
}

export default function ManagerPage() {
  return (
    <ManagerProvider>
      <ManagerModeContent />
    </ManagerProvider>
  );
}
