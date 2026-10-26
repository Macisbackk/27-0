"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { deleteMyAccount } from "@/lib/auth";
import { clearDeviceAccountData } from "@/lib/storage/account-owner";
import { GameButton } from "@/components/ui/GameButton";
import { CONTACT_EMAIL } from "@/lib/contact";

const CONTACT = CONTACT_EMAIL;

/** Account deletion (Google Play / App Store requirement): in-app and at a public web address. */
export function DeleteAccountPanel() {
  const { loading, isLoggedIn, user } = useAuth();
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [typed, setTyped] = useState("");

  const onDelete = async () => {
    setStep("busy");
    const result = await deleteMyAccount();
    if (result.ok) {
      clearDeviceAccountData();
      setStep("done");
    } else {
      setStep("error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 text-center">
      <header className="py-2">
        <h1 className="text-[26px] font-bold text-white">Delete account</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[color:var(--fl-muted)]">
          This permanently deletes your 27-0 account: your login, coach name, leaderboard entries, stats, Club Funds and
          Manager Mode save. It can&rsquo;t be undone.
        </p>
      </header>

      <section className="rounded-card bg-pitch-900 p-4">
        {loading ? (
          <p className="text-sm text-[color:var(--fl-muted)]">Checking your account…</p>
        ) : step === "done" ? (
          <>
            <p className="text-[17px] font-bold text-white">Your account has been deleted.</p>
            <p className="mt-1 text-sm text-[color:var(--fl-muted)]">Thanks for playing 27-0.</p>
            <Link href="/" className="btn-press mx-auto mt-4 flex h-11 max-w-[240px] items-center justify-center rounded-control bg-pitch-800 text-sm font-bold text-white">
              Back to home
            </Link>
          </>
        ) : !isLoggedIn ? (
          <>
            <p className="text-[15px] font-bold text-white">You&rsquo;re not logged in</p>
            <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
              Log in to delete your account here, or email{" "}
              <a className="font-semibold text-theme-primary" href={`mailto:${CONTACT}?subject=Delete%20my%2027-0%20account`}>
                {CONTACT}
              </a>{" "}
              from the address you signed up with and we&rsquo;ll delete it within 30 days.
            </p>
            <p className="mt-2 text-sm text-[color:var(--fl-muted)]">
              Playing as a guest? There&rsquo;s no account: your progress lives only on your device and is removed when
              you clear the app&rsquo;s data.
            </p>
            <Link href="/login?redirect=/delete-account" className="btn-press mx-auto mt-4 flex h-11 max-w-[240px] items-center justify-center rounded-control bg-pitch-800 text-sm font-bold text-white">
              Log in
            </Link>
          </>
        ) : step === "error" ? (
          <>
            <p className="text-[15px] font-bold text-white">We couldn&rsquo;t delete it automatically</p>
            <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
              Email{" "}
              <a className="font-semibold text-theme-primary" href={`mailto:${CONTACT}?subject=Delete%20my%2027-0%20account`}>
                {CONTACT}
              </a>{" "}
              from {user?.email ?? "your account's email"} and we&rsquo;ll delete everything within 30 days.
            </p>
            <GameButton variant="secondary" size="sm" className="mx-auto mt-4 max-w-[240px]" onClick={() => setStep("confirm")}>
              Try again
            </GameButton>
          </>
        ) : step === "confirm" || step === "busy" ? (
          <>
            <label className="block text-left">
              <span className="text-sm font-semibold text-white">Type DELETE to confirm</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                className="game-input mt-2 w-full px-3 text-white"
                aria-label="Type DELETE to confirm"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <GameButton variant="secondary" size="sm" onClick={() => setStep("idle")} disabled={step === "busy"}>
                Cancel
              </GameButton>
              <GameButton variant="danger" size="sm" disabled={typed.trim().toUpperCase() !== "DELETE" || step === "busy"} onClick={() => void onDelete()}>
                {step === "busy" ? "Deleting…" : "Delete forever"}
              </GameButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[color:var(--fl-muted)]">
              Logged in as <span className="font-semibold text-white">{user?.email}</span>
            </p>
            <GameButton variant="danger" size="sm" className="mx-auto mt-4 max-w-[240px]" onClick={() => setStep("confirm")}>
              Delete my account
            </GameButton>
          </>
        )}
      </section>

      <p className="text-xs text-[color:var(--fl-muted)]">
        See our{" "}
        <Link href="/privacy" className="font-semibold text-theme-primary">
          privacy policy
        </Link>{" "}
        for what we store.
      </p>
    </div>
  );
}
