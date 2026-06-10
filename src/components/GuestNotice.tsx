"use client";

import { useAuth } from "@/lib/auth-context";

interface GuestNoticeProps {
  variant?: "home" | "play" | "inline";
}

const GUEST_NOTICE_TEXT =
  "Playing as Guest — your records are saved on this device only.";

export function GuestNotice({ variant = "inline" }: GuestNoticeProps) {
  const { isLoggedIn, loading } = useAuth();

  if (loading || isLoggedIn) return null;

  if (variant === "home") {
    return (
      <p className="mx-auto mt-4 max-w-md text-center text-xs text-gray-500">
        {GUEST_NOTICE_TEXT}
      </p>
    );
  }

  if (variant === "play") {
    return (
      <div className="mb-4 rounded-lg border border-pitch-600/50 bg-pitch-900/50 px-4 py-2.5 text-center text-xs text-gray-400">
        {GUEST_NOTICE_TEXT}
      </div>
    );
  }

  return <p className="text-xs text-gray-500">{GUEST_NOTICE_TEXT}</p>;
}
