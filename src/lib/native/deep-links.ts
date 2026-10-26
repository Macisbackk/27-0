import { supabase } from "@/lib/supabase";
import { markEmailConfirmPending } from "@/lib/auth-callback";
import { APP_URL_SCHEME } from "@/lib/native/platform";

export type DeepLinkResult = { route: string } | null;

function paramsFrom(url: URL): URLSearchParams {
  const merged = new URLSearchParams(url.search);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  new URLSearchParams(hash).forEach((value, key) => merged.set(key, value));
  return merged;
}

/** In-app route for a link path such as "auth/callback" or "/leaderboard". */
function routeFor(path: string): string {
  const clean = `/${path.replace(/^\/+/, "")}`;
  return clean === "/" ? "/" : clean.endsWith("/") ? clean : `${clean}/`;
}

/**
 * Handle a link that opened the app:
 *  - com.twentysevenzero.game://auth/callback#access_token=…&refresh_token=…&type=signup (email confirm)
 *  - com.twentysevenzero.game://auth/reset-password#…&type=recovery (password reset)
 *  - …?code=… (PKCE), or …#error=… (expired link)
 *  - https://27-0.co.uk/<path> (universal / app links, once set up) → same page inside the app.
 * Returns the in-app route to show, or null when the link isn't ours.
 */
export async function handleAppUrl(rawUrl: string): Promise<DeepLinkResult> {
  let url: URL;
  let path: string;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol === `${APP_URL_SCHEME}:`) {
    // com.twentysevenzero.game://auth/callback parses as host "auth" + path "/callback".
    path = `${url.host}${url.pathname}`;
  } else if (url.protocol === "https:" && /(^|\.)27-0\.co\.uk$/i.test(url.hostname)) {
    path = url.pathname;
  } else {
    return null;
  }

  const params = paramsFrom(url);
  const isAuth = path.replace(/^\/+/, "").startsWith("auth/");
  if (!isAuth) return { route: routeFor(path) + (url.search || "") };

  const isRecovery = params.get("type") === "recovery" || path.includes("reset-password");

  const errorDescription = params.get("error_description") ?? params.get("error");
  if (errorDescription) {
    // The reset page explains an expired link; for sign-up the account is usually confirmed anyway, so log in.
    return { route: isRecovery ? "/auth/reset-password/" : "/login/" };
  }

  try {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
  } catch {
    return { route: isRecovery ? "/auth/reset-password/" : "/login/" };
  }

  if (isRecovery) return { route: "/auth/reset-password/" };
  markEmailConfirmPending();
  return { route: "/?emailConfirmed=1" };
}
