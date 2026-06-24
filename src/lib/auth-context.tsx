"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  createProfile,
  fetchProfile,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type AuthActionResult,
  type UserProfile,
} from "./auth";
import { setAuthCache } from "./auth-session";
import { supabase } from "./supabase";
import {
  cleanAuthRedirectFromUrl,
  detectEmailConfirmationRedirect,
  markEmailConfirmPending,
} from "./auth-callback";
import { loadCloudStats } from "./storage/stats-cloud";
import { loadCloudClubFunds } from "./storage/club-funds-cloud";
import { mergeClubFundsFromCloud, syncClubFundsLeaderboardOnLoad } from "./storage/club-funds";
import { mergeUiThemeStoreFromCloud } from "./storage/ui-theme-store";
import { STORAGE_KEYS } from "./storage/keys";
import { getAllStats, mergeCloudStatsWithLocal } from "./storage/stats";
import { runCoachbeardAccountMergeLocal } from "./storage/coachbeard-account-merge";
import { isSupabaseConfigured } from "./supabase";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggedIn: boolean;
  coachName: string | null;
  email: string | null;
  signUp: (
    email: string,
    password: string,
    confirmPassword: string,
    coachName: string
  ) => Promise<AuthActionResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function hydrateStatsFromCloud(): Promise<void> {
  const cloud = await loadCloudStats();
  if (!cloud) return;
  const local = getAllStats();
  const merged = mergeCloudStatsWithLocal(cloud, local);
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(merged));
}

async function hydrateClubFundsFromCloud(): Promise<void> {
  const cloud = await loadCloudClubFunds();
  mergeClubFundsFromCloud(cloud);
  syncClubFundsLeaderboardOnLoad();
}

async function hydrateUiThemeFromCloud(): Promise<void> {
  await mergeUiThemeStoreFromCloud();
}

function applySession(session: Session | null, profile: UserProfile | null) {
  const user = session?.user ?? null;
  setAuthCache(
    user?.id ?? null,
    profile?.coach_name ?? null,
    user?.email ?? null
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncFromSession = useCallback(async (session: Session | null) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      applySession(null, null);
      window.dispatchEvent(new Event("auth-state-changed"));
      return;
    }

    let nextProfile = await fetchProfile(nextUser.id);
    if (!nextProfile) {
      const metaName = nextUser.user_metadata?.coach_name as string | undefined;
      if (metaName) {
        await createProfile(nextUser.id, metaName);
        nextProfile = await fetchProfile(nextUser.id);
      }
    }

    setProfile(nextProfile);
    applySession(session, nextProfile);

    runCoachbeardAccountMergeLocal({
      coachName: nextProfile?.coach_name ?? null,
      email: nextUser.email ?? null,
    });

    await hydrateStatsFromCloud();
    await hydrateClubFundsFromCloud();
    await hydrateUiThemeFromCloud();
    window.dispatchEvent(new Event("auth-state-changed"));
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      applySession(null, null);
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const hadConfirmRedirect = detectEmailConfirmationRedirect();
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await syncFromSession(data.session);
        if (hadConfirmRedirect) {
          markEmailConfirmPending();
          cleanAuthRedirectFromUrl();
        }
      } catch (err) {
        console.error("[auth] session init failed:", err);
        if (mounted) {
          applySession(null, null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && detectEmailConfirmationRedirect()) {
        markEmailConfirmPending();
        cleanAuthRedirectFromUrl();
      }
      void syncFromSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncFromSession]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      confirmPassword: string,
      coachName: string
    ) => {
      if (password !== confirmPassword) {
        return { ok: false, error: "Passwords do not match." };
      }
      const result = await authSignUp(email, password, coachName);
      if (result.ok) {
        const { data } = await supabase.auth.getSession();
        await syncFromSession(data.session);
      }
      return result;
    },
    [syncFromSession]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authSignIn(email, password);
      if (result.ok) {
        const { data } = await supabase.auth.getSession();
        await syncFromSession(data.session);
      }
      return result;
    },
    [syncFromSession]
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
    applySession(null, null);
    window.dispatchEvent(new Event("auth-state-changed"));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isLoggedIn: !!user,
      coachName: profile?.coach_name ?? null,
      email: user?.email ?? null,
      signUp,
      signIn,
      signOut,
    }),
    [user, profile, loading, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
