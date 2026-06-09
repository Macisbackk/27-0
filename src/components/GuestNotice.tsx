"use client";

import { useAuth } from "@/lib/auth-context";

interface GuestNoticeProps {
  variant?: "home" | "play" | "inline";
}

export function GuestNotice({ variant = "inline" }: GuestNoticeProps) {
  const { isLoggedIn, loading } = useAuth();

  if (loading || isLoggedIn) return null;

  const text =
    "Playing as Guest. Your records will be saved on this device only and will not appear on online leaderboards.";

  if (variant === "home") {
    return (
      <p className="mx-auto mt-4 max-w-md text-center text-xs text-gray-500">
        {text}
      </p>
    );
  }

  if (variant === "play") {
    return (
      <div className="mb-4 rounded-lg border border-pitch-600/50 bg-pitch-900/50 px-4 py-2.5 text-center text-xs text-gray-400">
        {text}
      </div>
    );
  }

  return (
    <p className="text-xs text-gray-500">{text}</p>
  );
}
