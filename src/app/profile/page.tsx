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
import { PageShell } from "@/components/ui/PageShell";
import { RL_INFO_BOX_CLASS } from "@/components/cards/rl-card";
import { BTN, CARD, LINK, PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface StoredStats {
  normal: UserStatsData;
  hard: UserStatsData;
  draftNormal: UserStatsData;
  draftHard: UserStatsData;
  eraNormal: UserStatsData;
}

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

function ProfileStatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${RL_INFO_BOX_CLASS} p-4`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold ${
          highlight ? "text-accent-gold" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { loading, isLoggedIn, coachName, email, profile, signOut } = useAuth();
  const [stats, setStats] = useState<StoredStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [statsResetConfirm, setStatsResetConfirm] = useState(false);
  const [statsResetBusy, setStatsResetBusy] = useState(false);
  const [statsResetMsg, setStatsResetMsg] = useState<string | null>(null);
  const [statsResetError, setStatsResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/login?redirect=/profile");
    }
  }, [loading, isLoggedIn, router]);

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
          ? "Career stats reset on this device and your online account."
          : "Career stats reset on this device."
      );
    } else {
      setStatsResetError(result.error ?? "Could not reset career stats.");
    }
    setStatsResetBusy(false);
  };

  if (loading) {
    return (
      <PageShell compact>
        <p className={TYPO.bodySm}>Loading profile…</p>
      </PageShell>
    );
  }

  if (!isLoggedIn) {
    return (
      <PageShell compact>
        <div className={`${CARD.hero} p-4 sm:p-6`}>
          <p className={TYPO.body}>Log in to view your coach profile.</p>
          <Link href="/login?redirect=/profile" className={`mt-3 inline-block ${LINK.accent}`}>
            Log in →
          </Link>
        </div>
      </PageShell>
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
  const totalRecord = view
    ? formatRecordOrDash(view.totalRecord)
    : "—";

  return (
    <PageShell withLights compact>
      <div className={PAGE.section}>
        <header>
          <p className={TYPO.sectionLabel}>Account</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>Coach Profile</h1>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
            Your account, cloud sync status, and a quick snapshot of Quick Mode
            runs. For deep dives and filters, use Stats.
          </p>
        </header>

        <div className="space-y-5">
        <SectionCard title="Account">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={TYPO.sectionLabel}>Coach name</dt>
              <dd className={`mt-1 ${TYPO.cardTitle}`}>{coachName ?? "—"}</dd>
            </div>
            <div>
              <dt className={TYPO.sectionLabel}>Email</dt>
              <dd className={`mt-1 break-all ${TYPO.body}`}>{email ?? "—"}</dd>
            </div>
            {memberSince && (
              <div className="sm:col-span-2">
                <dt className={TYPO.sectionLabel}>Member since</dt>
                <dd className={`mt-1 ${TYPO.body}`}>{memberSince}</dd>
              </div>
            )}
          </dl>
        </SectionCard>

        <SectionCard
          title="Quick Mode snapshot"
          helper="Logged-in runs sync to the cloud. Manager careers stay on this device unless exported."
        >
          {statsLoading || !view ? (
            <p className={TYPO.bodySm}>Loading career stats…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileStatCard
                label="Seasons Played"
                value={String(view.totalSeasons)}
              />
              <ProfileStatCard
                label="Match Wins"
                value={String(view.totalRecord.wins)}
              />
              <ProfileStatCard
                label="Match Losses"
                value={String(view.totalRecord.losses)}
              />
              <ProfileStatCard label="Match Record" value={totalRecord} />
              <ProfileStatCard
                label="Minor Premierships"
                value={String(view.leagueTitles)}
                highlight={view.leagueTitles > 0}
              />
              <ProfileStatCard
                label="Super League Titles"
                value={String(view.superLeagueTitles)}
                highlight={view.superLeagueTitles > 0}
              />
              <ProfileStatCard
                label="27-0 Seasons"
                value={String(view.perfectSeasons)}
                highlight={view.perfectSeasons > 0}
              />
              <ProfileStatCard
                label="0-27 Seasons"
                value={String(view.winlessSeasons)}
              />
            </div>
          )}
          <p className={`mt-4 ${TYPO.bodySm}`}>
            <Link href="/stats" className={LINK.subtle}>
              View detailed stats →
            </Link>
          </p>
          <div className="mt-5 border-t border-pitch-700/50 pt-4">
            <p className={TYPO.bodySm}>
              Reset Quick Mode wins, seasons, and trophies tracked in Stats.
              Manager Mode saves on this device are not affected. Leaderboard
              entries are not removed.
            </p>
            {statsResetConfirm ? (
              <div className="mt-3 rounded-lg border border-red-500/35 bg-red-950/20 p-3">
                <p className={`${TYPO.bodySm} text-red-200`}>
                  This cannot be undone. Clear all Quick Mode career stats?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={statsResetBusy}
                    onClick={() => void handleResetCareerStats()}
                    className={`${BTN.base} ${BTN.danger} text-xs`}
                  >
                    Yes, reset career stats
                  </button>
                  <button
                    type="button"
                    disabled={statsResetBusy}
                    onClick={() => {
                      setStatsResetConfirm(false);
                      setStatsResetError(null);
                    }}
                    className={`${BTN.base} ${BTN.secondary} text-xs`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={statsResetBusy}
                onClick={() => void handleResetCareerStats()}
                className={`${BTN.base} ${BTN.danger} mt-3 text-xs`}
              >
                Reset career stats
              </button>
            )}
            {statsResetMsg && (
              <p className={`mt-3 ${TYPO.body} text-accent-green`}>{statsResetMsg}</p>
            )}
            {statsResetError && (
              <p className={`mt-3 ${TYPO.body} text-red-400`}>{statsResetError}</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Password">
          <p className={TYPO.bodySm}>
            Send a reset link to your account email to choose a new password.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={resetBusy || !email}
              onClick={() => void handlePasswordReset()}
              className={`${BTN.base} ${BTN.secondary} text-[10px] sm:text-xs`}
            >
              Send Password Reset Email
            </button>
          </div>
          {resetMsg && (
            <p className={`mt-3 ${TYPO.body} text-accent-green`}>{resetMsg}</p>
          )}
          {resetError && (
            <p className={`mt-3 ${TYPO.body} text-red-400`}>{resetError}</p>
          )}
        </SectionCard>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className={`${BTN.base} ${BTN.danger} text-xs`}
          >
            Log Out
          </button>
          <Link href="/" className={`${BTN.base} ${BTN.secondary} text-xs`}>
            Back to Home
          </Link>
        </div>
        </div>
      </div>
    </PageShell>
  );
}
