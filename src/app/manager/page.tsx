"use client";

import React from "react";
import { ManagerProvider, useManager } from "@/lib/manager/context";
import { ManagerClubSelect } from "@/components/manager/ManagerClubSelect";
import { ManagerHeader } from "@/components/manager/ManagerHeader";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { ManagerMobileBottomNav } from "@/components/manager/ManagerMobileBottomNav";
import { ManagerMobilePlayBar } from "@/components/manager/ManagerMobilePlayBar";
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
import { ManagerHistoryView } from "@/components/manager/ManagerHistoryView";
import { ManagerInboxView } from "@/components/manager/ManagerInboxView";
import { ManagerSettingsView } from "@/components/manager/ManagerSettingsView";
import { ManagerMatchReviewModal } from "@/components/manager/ManagerMatchReviewModal";
import { ManagerKeyMomentsModal } from "@/components/manager/ManagerKeyMomentsModal";
import { ManagerSeasonAwardsModal } from "@/components/manager/ManagerSeasonAwardsModal";
import { ManagerContractExpiryModal } from "@/components/manager/ManagerContractExpiryModal";
import { ManagerIncomingOfferModal } from "@/components/manager/ManagerIncomingOfferModal";
import { ManagerTutorialModal } from "@/components/manager/ManagerTutorialModal";
import { useCompactViewport } from "@/lib/ui/viewport";

function ManagerModeContent() {
  const { state, activeTab, isLoading } = useManager();
  const compact = useCompactViewport();

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
    <div
      className={`min-h-screen bg-pitch-950 text-pitch-100 flex flex-col ${
        compact ? "manager-mobile-nav-pad manager-mobile-playbar-extra" : ""
      }`}
    >
      <ManagerHeader />
      {/* Desktop top tabs — hidden on phones (bottom nav replaces them). */}
      <div className="hidden sm:block">
        <ManagerNav />
      </div>

      <main className="flex-1 min-w-0">
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
        {activeTab === "history" && <ManagerHistoryView />}
        {activeTab === "settings" && <ManagerSettingsView />}
      </main>

      {/* Mobile chrome — always mounted; StickyActionBar / nav self-hide on sm+. */}
      <ManagerMobilePlayBar />
      <ManagerMobileBottomNav />

      <ManagerTutorialModal />
      <ManagerKeyMomentsModal />
      <ManagerMatchReviewModal />
      <ManagerSeasonAwardsModal />
      <ManagerIncomingOfferModal />
      <ManagerContractExpiryModal />
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
