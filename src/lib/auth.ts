import {
  getEmailConfirmRedirectUrl,
  getPasswordResetRedirectUrl,
} from "./auth-redirect";
import { isSupabaseConfigured, supabase } from "./supabase";
import {
  type AuthActionResult,
  loginSuccessResult,
  mapAuthError,
  signupSuccessResult,
} from "./auth-errors";
import { validateCoachName } from "./storage/user";

/** Keep in sync with Supabase → Auth → Email → Minimum password length. */
export const MIN_PASSWORD_LENGTH = 8;

export type { AuthActionResult };

export interface UserProfile {
  id: string;
  coach_name: string;
  created_at: string;
  updated_at: string;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, coach_name, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as UserProfile | null;
  } catch (err) {
    console.error("[auth] fetchProfile failed:", err);
    return null;
  }
}

export async function isCoachNameTaken(
  coachName: string,
  excludeUserId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const validation = validateCoachName(coachName);
  if (!validation.valid || !validation.value) return false;

  try {
    let query = supabase
      .from("profiles")
      .select("id")
      .ilike("coach_name", validation.value)
      .limit(1);
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error("[auth] isCoachNameTaken failed:", err);
    return true;
  }
}

export async function createProfile(
  userId: string,
  coachName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const validation = validateCoachName(coachName);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  if (await isCoachNameTaken(coachName)) {
    return { ok: false, error: "Coach name already taken." };
  }
  try {
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      coach_name: validation.value,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create profile.";
    return { ok: false, error: message };
  }
}

export async function updateProfileCoachName(
  userId: string,
  coachName: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const validation = validateCoachName(coachName);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }
  if (await isCoachNameTaken(coachName, userId)) {
    return { ok: false, error: "Coach name already taken." };
  }
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        coach_name: validation.value,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update coach name.";
    return { ok: false, error: message };
  }
}

export async function signUp(
  email: string,
  password: string,
  coachName: string
): Promise<AuthActionResult> {
  if (!email.trim()) return { ok: false, error: "Email is required." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const nameCheck = validateCoachName(coachName);
  if (!nameCheck.valid) return { ok: false, error: nameCheck.error };
  if (await isCoachNameTaken(coachName)) {
    return { ok: false, error: "Coach name already taken." };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { coach_name: nameCheck.value },
        emailRedirectTo: getEmailConfirmRedirectUrl(),
      },
    });
    if (error) throw error;

    // Supabase answers a sign-up for an email that already has an account with a
    // placeholder user (no identities) and sends no email, to avoid revealing accounts.
    // Tell the person to log in instead of waiting for an email that will never come.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        error:
          "There's already an account with this email. Log in instead, or use Forgot password if you can't remember it.",
      };
    }

    if (data.user) {
      await createProfile(data.user.id, nameCheck.value!);
    }

    if (data.session) {
      return loginSuccessResult();
    }

    return signupSuccessResult();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign up failed.";
    return mapAuthError(message, "signup");
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthActionResult> {
  if (!email.trim()) return { ok: false, error: "Email is required." };
  if (!password) return { ok: false, error: "Password is required." };

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return loginSuccessResult();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Log in failed.";
    return mapAuthError(message, "login");
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[auth] signOut failed:", err);
  }
}

export async function updatePassword(
  password: string
): Promise<AuthActionResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update password.";
    return mapAuthError(message, "signup");
  }
}

export async function sendPasswordResetEmail(
  email: string
): Promise<AuthActionResult> {
  if (!email.trim()) {
    return { ok: false, error: "Email is required." };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    if (error) throw error;
    return { ok: true, emailSent: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send reset email.";
    return mapAuthError(message, "signup");
  }
}

/**
 * Permanently delete the signed-in account and its online data (leaderboard entries, stats,
 * profile) via the `delete_my_account` database function, then sign out.
 */
export async function deleteMyAccount(): Promise<AuthActionResult> {
  try {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, error: "We couldn't delete your account automatically." };
    await supabase.auth.signOut().catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't delete your account automatically." };
  }
}
