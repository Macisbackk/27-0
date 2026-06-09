export interface AuthActionResult {
  ok: boolean;
  error?: string;
  emailSent?: boolean;
  rateLimited?: boolean;
  cooldownSeconds?: number;
}

const RATE_LIMIT_COOLDOWN_SECONDS = 300;
const SIGNUP_COOLDOWN_SECONDS = 120;

export function mapAuthError(
  message: string,
  context: "signup" | "login" = "signup"
): AuthActionResult {
  const lower = message.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("email rate") ||
    lower.includes("too many requests")
  ) {
    return {
      ok: false,
      error:
        "Too many email requests. Please wait a few minutes before trying again.",
      rateLimited: true,
      cooldownSeconds: RATE_LIMIT_COOLDOWN_SECONDS,
    };
  }

  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("user already registered")
  ) {
    return {
      ok: false,
      error:
        "An account with this email already exists. Try logging in instead.",
    };
  }

  if (
    lower.includes("password") &&
    (lower.includes("weak") ||
      lower.includes("short") ||
      lower.includes("at least"))
  ) {
    return {
      ok: false,
      error: "Password must be at least 6 characters.",
    };
  }

  if (lower.includes("invalid email") || lower.includes("valid email")) {
    return {
      ok: false,
      error: "Please enter a valid email address.",
    };
  }

  if (context === "login" && lower.includes("invalid login")) {
    return {
      ok: false,
      error: "Incorrect email or password.",
    };
  }

  return { ok: false, error: message };
}

export function signupSuccessResult(): AuthActionResult {
  return {
    ok: true,
    emailSent: true,
    cooldownSeconds: SIGNUP_COOLDOWN_SECONDS,
  };
}

export function loginSuccessResult(): AuthActionResult {
  return { ok: true };
}
