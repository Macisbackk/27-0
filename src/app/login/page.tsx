import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="mb-8 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green">
            Account
          </p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white">
            Log In
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in or create a coach profile for online leaderboards.
          </p>
        </div>

        <Suspense fallback={<div className="matchday-panel p-6 text-center text-sm text-gray-500">Loading…</div>}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-accent-green hover:underline">
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  );
}
