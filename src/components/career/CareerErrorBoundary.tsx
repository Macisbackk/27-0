"use client";

import { Component, type ReactNode } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { isLoggedIn } from "@/lib/auth-session";
import { loadLocalLegacy, pushCareerToCloud, saveLocalCareer } from "@/lib/career/storage";

/**
 * Catches a render crash inside Manager Mode (e.g. a damaged save) so players are never locked out.
 * Offers a retry, or a clean restart that keeps Legacy points, legends and records.
 */
export class CareerErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[career] Manager Mode crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Your career hit a problem</h1>
        <p className="text-sm text-gray-300">
          Something in this save couldn&apos;t be loaded. Try again, or start a fresh career. Your Legacy points, unlocked legends
          and records are kept either way.
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <GameButton variant="secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </GameButton>
          <GameButton
            onClick={async () => {
              saveLocalCareer(null);
              // Clear the cloud copy too, or sign-in sync would bring the broken save straight back.
              if (isLoggedIn()) await pushCareerToCloud(null, loadLocalLegacy());
              window.location.reload();
            }}
          >
            New career
          </GameButton>
        </div>
      </div>
    );
  }
}
