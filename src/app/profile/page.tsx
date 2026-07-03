"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { sendPasswordResetEmail } from "@/lib/auth";
import { getAllStats, mergeCloudStatsWithLocal } from "@/lib/storage/stats";
import { loadCloudStats } from "@/lib/storage/stats-cloud";
import { STORAGE_KEYS } from "@/lib/storage/keys";
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

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/login?redirect=/profile");
    }
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;

    let mounted = true;
    setStatsLoading(true);

    void (async () => {
      const cloud = await loadCloudStats();
      const local = getAllStats();
      const next = mergeCloudStatsWithLocal(cloud ?? local, local);
      localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(next));
      if (mounted) {
        setStats(next);
        setStatsLoading(false);
      }
    })();

    return () => {
      mounted = false;
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
    ? formatRecordOrDash({ wins: view.totalWins, losses: view.totalLosses })
    : "—";

  return (
    <PageShell withLights compact>
      <div className={PAGE.section}>
        <header>
          <p className={TYPO.sectionLabel}>Account</p>
          <h1 className={`mt-1 ${TYPO.pageTitle}`}>Coach Profile</h1>
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
          title="Total Record"
          helper="Across Current and Era Quick Mode runs."
        >
          {statsLoading || !view ? (
            <p className={TYPO.bodySm}>Loading career stats…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileStatCard label="Total Wins" value={String(view.totalWins)} />
              <ProfileStatCard
                label="Total Losses"
                value={String(view.totalLosses)}
              />
              <ProfileStatCard label="Total Record" value={totalRecord} />
              <ProfileStatCard label="Total Runs" value={String(view.totalRuns)} />
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
