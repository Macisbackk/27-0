"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { sendPasswordResetEmail } from "@/lib/auth";
import { getAllStats, resetCareerStats } from "@/lib/storage/stats";
import { importLocalStatsToCloud } from "@/lib/storage/stats-cloud";
import { SectionCard } from "@/components/ui/SectionCard";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameButton } from "@/components/ui/GameButton";
import { GameTabs } from "@/components/ui/GameTabs";
import { StatsPanel } from "@/components/StatsPanel";
import { AchievementsSection } from "@/components/achievements/AchievementsSection";
import { useAchievements } from "@/components/achievements/AchievementProvider";
import { LINK, MANAGER, PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { CoachCard } from "@/components/CoachCard";
import { titleName } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/storage/cosmetics-store";
import { useSquadBook } from "@/lib/squad-book";
import { PitchHero } from "@/components/ui/PitchHero";
import { WhistleGlyph } from "@/components/icons/rugby-icons";

/**
 * Coach Profile — one page for everything about you: Career Stats, Achievements and Account.
 * (Career Stats used to be its own page; /stats now redirects here.) Works for guests too.
 */
type ProfileTab = "stats" | "achievements" | "account";

const PROFILE_PILL =
  "inline-flex min-h-[44px] items-center gap-2 rounded-full bg-pitch-900 px-4 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:ring-theme-primary/40";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "achievements", label: "Achievements" },
  { id: "account", label: "Account" },
];

function formatMemberSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function tabFromHash(): ProfileTab {
  if (typeof window === "undefined") return "stats";
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "achievements") return "achievements";
  if (hash === "account" || hash === "password") return "account";
  return "stats";
}

export default function ProfilePage() {
  const { loading, isLoggedIn, coachName, email, profile, signOut } = useAuth();
  const cosmetics = useCosmetics();
  const squadBookCount = Object.keys(useSquadBook().cards).length;
  const equippedTitle = titleName(cosmetics.equipped.title);
  const [tab, setTab] = useState<ProfileTab>("stats");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [statsResetConfirm, setStatsResetConfirm] = useState(false);
  const [statsResetBusy, setStatsResetBusy] = useState(false);
  const [statsResetMsg, setStatsResetMsg] = useState<string | null>(null);
  const [statsResetError, setStatsResetError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const { notifyAchievements, isAchievementHydrated } = useAchievements();

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !isAchievementHydrated) return;
    notifyAchievements({ profileOpened: true });
  }, [isLoggedIn, isAchievementHydrated, notifyAchievements]);

  const selectTab = (next: ProfileTab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "stats" ? "/profile" : `/profile#${next}`);
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    setResetBusy(true);
    setResetMsg(null);
    setResetError(null);
    const result = await sendPasswordResetEmail(email);
    if (result.ok) setResetMsg("Reset link sent. Check your inbox.");
    else setResetError(result.error ?? "Could not send reset email.");
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
      setStatsResetConfirm(false);
      setStatsResetMsg(isLoggedIn ? "Classic stats reset everywhere." : "Classic stats reset on this device.");
    } else {
      setStatsResetError(result.error ?? "Could not reset career stats.");
    }
    setStatsResetBusy(false);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportMsg(null);
    const result = await importLocalStatsToCloud(getAllStats());
    setImportMsg(result.ok ? "Stats imported to your account." : (result.error ?? "Import failed."));
    setImporting(false);
  };

  const memberSince = formatMemberSince(profile?.created_at);

  return (
    <StandardPageShell withLights compact>
      <div className={`${PAGE.section} text-center`}>
        <PitchHero eyebrow="Your coach" title="Coach Profile" icon={<WhistleGlyph />} />
        <div className="mt-4 w-full">
          <CoachCard
            name={loading ? "Coach" : isLoggedIn ? (coachName ?? "Coach") : "Guest coach"}
            title={equippedTitle}
            frame={cosmetics.equipped.frame}
            subline={
              loading ? null : isLoggedIn ? (memberSince ? `Coach since ${memberSince}` : "Signed in") : "Saved on this device"
            }
          />
          {!loading && !isLoggedIn ? (
            <p className={`mt-3 text-center ${TYPO.bodySm}`}>
              <Link href="/login?redirect=/profile" className={LINK.accent}>
                Log in
              </Link>{" "}
              to save online and join the leaderboards.
            </p>
          ) : null}
        </div>

        {/* Leaderboard moved off the bottom bar: it lives here, one tap from Profile. */}
        <nav aria-label="Profile shortcuts" className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href="/leaderboard" className={PROFILE_PILL}>
            Leaderboard
            <span aria-hidden>→</span>
          </Link>
          <Link href="/squad-book" className={PROFILE_PILL}>
            Squad Book
            <span className="tabular-nums text-[color:var(--fl-muted)]">
              {squadBookCount} card{squadBookCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden>→</span>
          </Link>
          <Link href="/records" className={PROFILE_PILL}>
            Records
            <span aria-hidden>→</span>
          </Link>
          <Link href="/settings" className={PROFILE_PILL}>
            Settings
            <span aria-hidden>→</span>
          </Link>
        </nav>

        <div className="mt-4 flex justify-center">
          <GameTabs tabs={PROFILE_TABS} active={tab} onChange={selectTab} ariaLabel="Coach profile sections" />
        </div>

        <div className="mt-5 space-y-5 text-left">
          {tab === "stats" ? (
            <>
              {isLoggedIn ? (
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  <p className={TYPO.bodySm}>Synced to your account.</p>
                  <GameButton variant="secondary" size="sm" fullWidth={false} disabled={importing} onClick={() => void handleImport()}>
                    Import device stats
                  </GameButton>
                  {importMsg ? <p className={`w-full ${TYPO.bodySm}`}>{importMsg}</p> : null}
                </div>
              ) : null}
              <StatsPanel />
            </>
          ) : null}

          {tab === "achievements" ? <AchievementsSection /> : null}

          {tab === "account" ? (
            loading ? (
              <p className={`text-center ${TYPO.bodySm}`}>Loading…</p>
            ) : !isLoggedIn ? (
              <SectionCard title="Account">
                <p className={`${MANAGER.panelCenter} ${TYPO.body}`}>
                  You&apos;re a guest. Sign up free to save your progress and join the leaderboards.
                </p>
                <div className="mt-4 flex justify-center">
                  <GameButton variant="theme" size="sm" fullWidth={false} href="/login?redirect=/profile">
                    Log in or sign up
                  </GameButton>
                </div>
              </SectionCard>
            ) : (
              <>
                <SectionCard title="Account">
                  <dl className={`${MANAGER.panelCenter} grid gap-4 sm:grid-cols-2`}>
                    <div>
                      <dt className={TYPO.sectionLabel}>Coach name</dt>
                      <dd className={`mt-1 ${TYPO.cardTitle}`}>{coachName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className={TYPO.sectionLabel}>Email</dt>
                      <dd className={`mt-1 break-all ${TYPO.body}`}>{email ?? "—"}</dd>
                    </div>
                    {memberSince ? (
                      <div className="sm:col-span-2">
                        <dt className={TYPO.sectionLabel}>Member since</dt>
                        <dd className={`mt-1 ${TYPO.body}`}>{memberSince}</dd>
                      </div>
                    ) : null}
                  </dl>
                </SectionCard>

                <SectionCard title="Password">
                  <p className={`${MANAGER.panelCenter} ${TYPO.bodySm}`}>
                    We&apos;ll email you a reset link.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      disabled={resetBusy || !email}
                      onClick={() => void handlePasswordReset()}
                    >
                      Email reset link
                    </GameButton>
                  </div>
                  {resetMsg ? <p className={`mt-3 text-center ${TYPO.body} text-theme-primary`}>{resetMsg}</p> : null}
                  {resetError ? <p className={`mt-3 text-center ${TYPO.body} text-red-400`}>{resetError}</p> : null}
                </SectionCard>

                <SectionCard title="Career stats">
                  {statsResetConfirm ? (
                    <div className="mx-auto max-w-md rounded-lg border border-red-500/35 bg-red-950/20 p-3 text-center">
                      <p className={`${TYPO.bodySm} text-red-200`}>Clear all Classic stats? You can&apos;t undo this.</p>
                      <div className={MANAGER.actionRow}>
                        <GameButton variant="danger" size="sm" fullWidth={false} disabled={statsResetBusy} onClick={() => void handleResetCareerStats()}>
                          Yes, reset
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
                      <GameButton variant="danger" size="sm" fullWidth={false} disabled={statsResetBusy} onClick={() => void handleResetCareerStats()}>
                        Reset career stats
                      </GameButton>
                    </div>
                  )}
                  {statsResetMsg ? <p className={`mt-3 text-center ${TYPO.body} text-theme-primary`}>{statsResetMsg}</p> : null}
                  {statsResetError ? <p className={`mt-3 text-center ${TYPO.body} text-red-400`}>{statsResetError}</p> : null}
                </SectionCard>

                <div className={`${MANAGER.actionRow} mt-2`}>
                  <GameButton variant="danger" size="sm" fullWidth={false} onClick={() => void signOut()}>
                    Log out
                  </GameButton>
                </div>
              </>
            )
          ) : null}
        </div>
      </div>
    </StandardPageShell>
  );
}
