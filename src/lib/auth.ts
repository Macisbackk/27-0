import { isSupabaseConfigured, supabase } from "./supabase";
import {
  type AuthActionResult,
  loginSuccessResult,
  mapAuthError,
  signupSuccessResult,
} from "./auth-errors";
import { validateCoachName } from "./storage/user";

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
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const nameCheck = validateCoachName(coachName);
  if (!nameCheck.valid) return { ok: false, error: nameCheck.error };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { coach_name: nameCheck.value } },
    });
    if (error) throw error;

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
