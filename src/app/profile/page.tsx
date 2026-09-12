"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { sendPasswordResetEmail } from "@/lib/auth";
import { getAllStats, resetCareerStats } from "@/lib/storage/stats";
import type { UserStatsData } from "@/lib/types";
import {
  formatRecordOrDash,
  getOverallView,
} from "@/lib/stats-views";
import { SectionCard } from "@/components/ui/SectionCard";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameButton } from "@/components/ui/GameButton";
import { GameStatCard } from "@/components/ui/GameStatCard";
import { GameTabs } from "@/components/ui/GameTabs";
import { AchievementsSection } from "@/components/achievements/AchievementsSection";
import { useAchievements } from "@/components/achievements/AchievementProvider";
import { CARD, LINK, MANAGER, PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface StoredStats {
  normal: UserStatsData;
  hard: UserStatsData;
  draftNormal: UserStatsData;
  draftHard: UserStatsData;
  eraNormal: UserStatsData;
}

type ProfileTab = "account" | "achievements" | "password";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "achievements", label: "Achievements" },
  { id: "password", label: "Password" },
];

function formatMemberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tabFromHash(): ProfileTab {
  if (typeof window === "undefined") return "account";
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "achievements") return "achievements";
  if (hash === "password") return "password";
  return "account";
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, isLoggedIn, coachName, email, profile, signOut } = useAuth();
  const [stats, setStats] = useState<StoredStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("account");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [statsResetConfirm, setStatsResetConfirm] = useState(false);
  const [statsResetBusy, setStatsResetBusy] = useState(false);
  const [statsResetMsg, setStatsResetMsg] = useState<string | null>(null);
  const [statsResetError, setStatsResetError] = useState<string | null>(null);
  const { notifyAchievements, isAchievementHydrated } = useAchievements();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/login?redirect=/profile");
    }
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const refresh = () => {
      setStats(getAllStats());
      setStatsLoading(false);
    };

    setStatsLoading(true);
    refresh();
    window.addEventListener("auth-state-changed", refresh);
    window.addEventListener("stats-merged", refresh);

    return () => {
      window.removeEventListener("auth-state-changed", refresh);
      window.removeEventListener("stats-merged", refresh);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !isAchievementHydrated) return;
    notifyAchievements({ profileOpened: true });
  }, [isLoggedIn, isAchievementHydrated, notifyAchievements]);

  const selectTab = (next: ProfileTab) => {
    setTab(next);
    const hash = next === "account" ? "/profile" : `/profile#${next}`;
    window.history.replaceState(null, "", hash);
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    setResetBusy(true);
    setResetMsg(null);
    setResetError(null);
    const result = await sendPasswordResetEmail(email);
    if (result.ok) {
      setResetMsg("Password reset email sent. Check your inbox.");
    } else {
      setResetError(result.error ?? "Could not send reset email.");
    }
    setResetBusy(false);
  };

  const handleResetCareerStats = async () => {
    if (!statsResetConfirm) {
      setStatsResetMsg(null);
      setStatsResetError(null);
      setStatsResetConfirm(true);
      return;
    }

    setStatsResetBusy(true);
    setStatsResetMsg(null);
    setStatsResetError(null);
    const result = await resetCareerStats();
    if (result.ok) {
      setStats(getAllStats());
      setStatsResetConfirm(false);
      setStatsResetMsg(
        isLoggedIn
          ? "Career stats reset everywhere."
          : "Career stats reset on this device."
      );
    } else {
      setStatsResetError(result.error ?? "Could not reset career stats.");
    }
    setStatsResetBusy(false);
  };

  if (loading) {
    return (
      <StandardPageShell compact>
        <p className={`text-center ${TYPO.bodySm}`}>Loading profile…</p>
      </StandardPageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <StandardPageShell compact>
        <div className={`${CARD.hero} p-4 text-center sm:p-6`}>
          <p className={TYPO.body}>Log in to view your coach profile.</p>
          <Link
            href="/login?redirect=/profile"
            className={`mt-3 inline-block ${LINK.accent}`}
          >
            Log in →
          </Link>
        </div>
      </StandardPageShell>
    );
  }

  const memberSince = formatMemberSince(profile?.created_at);
  const view = stats
    ? getOverallView(
        stats.normal,
        stats.hard,
        stats.draftNormal,
        stats.draftHard,
        stats.eraNormal
      )
    : null;
  const totalRecord = view ? formatRecordOrDash(view.totalRecord) : "—";

  return (
    <StandardPageShell withLights compact>
      <div className={`${PAGE.section} text-center`}>
        <header className="w-full text-center">
          <p className={TYPO.sectionLabel}>Account</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>Coach Profile</h1>
        </header>

        <div className="mt-4 flex justify-center">
          <GameTabs
            tabs={PROFILE_TABS}
            active={tab}
            onChange={selectTab}
            ariaLabel="Coach profile sections"
          />
        </div>

        <div className="mt-5 space-y-5">
          {tab === "account" ? (
            <>
              <SectionCard title="Account">
                <dl className={`${MANAGER.panelCenter} grid gap-4 sm:grid-cols-2`}>
                  <div>
                    <dt className={TYPO.sectionLabel}>Coach name</dt>
                    <dd className={`mt-1 ${TYPO.cardTitle}`}>
                      {coachName ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className={TYPO.sectionLabel}>Email</dt>
                    <dd className={`mt-1 break-all ${TYPO.body}`}>
                      {email ?? "—"}
                    </dd>
                  </div>
                  {memberSince ? (
                    <div className="sm:col-span-2">
                      <dt className={TYPO.sectionLabel}>Member since</dt>
                      <dd className={`mt-1 ${TYPO.body}`}>{memberSince}</dd>
                    </div>
                  ) : null}
                </dl>
              </SectionCard>

              <SectionCard title="Classic snapshot">
                {statsLoading || !view ? (
                  <p className={TYPO.bodySm}>Loading career stats…</p>
                ) : (
                  <div className={MANAGER.statGrid3}>
                    <GameStatCard
                      label="Seasons Played"
                      value={String(view.totalSeasons)}
                      neutral
                    />
                    <GameStatCard
                      label="Match Wins"
                      value={String(view.totalRecord.wins)}
                      neutral
                    />
                    <GameStatCard
                      label="Match Losses"
                      value={String(view.totalRecord.losses)}
                      neutral
                    />
                    <GameStatCard
                      label="Match Record"
                      value={totalRecord}
                      neutral
                    />
                    <GameStatCard
                      label="Minor Premierships"
                      value={
                        <span
                          className={
                            view.leagueTitles > 0 ? "text-accent-gold" : undefined
                          }
                        >
                          {view.leagueTitles}
                        </span>
                      }
                      neutral
                    />
                    <GameStatCard
                      label="Super League Titles"
                      value={
                        <span
                          className={
                            view.superLeagueTitles > 0
                              ? "text-accent-gold"
                              : undefined
                          }
                        >
                          {view.superLeagueTitles}
                        </span>
                      }
                      neutral
                    />
                    <GameStatCard
                      label="27-0 Seasons"
                      value={
                        <span
                          className={
                            view.perfectSeasons > 0
                              ? "text-accent-gold"
                              : undefined
                          }
                        >
                          {view.perfectSeasons}
                        </span>
                      }
                      neutral
                    />
                    <GameStatCard
                      label="0-27 Seasons"
                      value={String(view.winlessSeasons)}
                      neutral
                    />
                  </div>
                )}
                <p className={`mt-4 ${TYPO.bodySm}`}>
                  <Link href="/stats" className={LINK.subtle}>
                    View detailed stats →
                  </Link>
                </p>
                <div className="mt-5 border-t border-pitch-700/50 pt-4">
                  {statsResetConfirm ? (
                    <div className="mx-auto max-w-md rounded-lg border border-red-500/35 bg-red-950/20 p-3">
                      <p className={`${TYPO.bodySm} text-red-200`}>
                        Clear all career stats? Can&apos;t undo.
                      </p>
                      <div className={MANAGER.actionRow}>
                        <GameButton
                          variant="danger"
                          size="sm"
                          fullWidth={false}
                          disabled={statsResetBusy}
                          onClick={() => void handleResetCareerStats()}
                        >
                          Yes, reset career stats
                        </GameButton>
                        <GameButton
                          variant="secondary"
                          size="sm"
                          fullWidth={false}
                          disabled={statsResetBusy}
                          onClick={() => {
                            setStatsResetConfirm(false);
                            setStatsResetError(null);
                          }}
                        >
                          Cancel
                        </GameButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <GameButton
                        variant="danger"
                        size="sm"
                        fullWidth={false}
                        disabled={statsResetBusy}
                        onClick={() => void handleResetCareerStats()}
                      >
                        Reset career stats
                      </GameButton>
                    </div>
                  )}
                  {statsResetMsg ? (
                    <p className={`mt-3 ${TYPO.body} text-theme-primary`}>
                      {statsResetMsg}
                    </p>
                  ) : null}
                  {statsResetError ? (
                    <p className={`mt-3 ${TYPO.body} text-red-400`}>
                      {statsResetError}
                    </p>
                  ) : null}
                </div>
              </SectionCard>
            </>
          ) : null}

          {tab === "achievements" ? <AchievementsSection /> : null}

          {tab === "password" ? (
            <SectionCard title="Password">
              <p className={`${MANAGER.panelCenter} ${TYPO.bodySm}`}>
                Send a reset link to your account email to choose a new password.
              </p>
              <div className="mt-4 flex justify-center">
                <GameButton
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  className="mx-auto"
                  disabled={resetBusy || !email}
                  onClick={() => void handlePasswordReset()}
                >
                  Send Password Reset Email
                </GameButton>
              </div>
              {resetMsg ? (
                <p className={`mt-3 ${TYPO.body} text-theme-primary`}>
                  {resetMsg}
                </p>
              ) : null}
              {resetError ? (
                <p className={`mt-3 ${TYPO.body} text-red-400`}>{resetError}</p>
              ) : null}
            </SectionCard>
          ) : null}

          <div className={`${MANAGER.actionRow} mt-2`}>
            <GameButton
              variant="danger"
              size="sm"
              fullWidth={false}
              onClick={() => void signOut()}
            >
              Log Out
            </GameButton>
            <GameButton
              variant="secondary"
              size="sm"
              fullWidth={false}
              href="/"
            >
              Back to Home
            </GameButton>
          </div>
        </div>
      </div>
    </StandardPageShell>
  );
}
