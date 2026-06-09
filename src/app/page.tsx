import Link from "next/link";
import { AuthCoachCard } from "@/components/AuthCoachCard";
import { EmailConfirmedBanner } from "@/components/EmailConfirmedBanner";
import { HomeModeSelector } from "@/components/HomeModeSelector";
import { JoeMellorEasterEgg } from "@/components/JoeMellorEasterEgg";

export default function HomePage() {
  return (
    <div className="matchday-arena min-h-screen">
      <div className="stadium-backdrop pointer-events-none fixed inset-0" />
      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <div className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green">
            Super League Squad Builder
          </p>
          <h1 className="mt-3 text-5xl font-black tracking-tight sm:text-7xl">
            <span className="text-gradient">27</span>
            <span className="text-white">-0</span>
          </h1>
          <p className="mt-4 text-lg text-gray-300 sm:text-xl">
            Build the most valuable Super League team through strategic
            recruitment.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Build your squad on the team sheet — can you go 27-0?
          </p>
        </div>

        <EmailConfirmedBanner />

        <div className="mt-10">
          <AuthCoachCard />
        </div>

        <div id="play-modes" className="mt-8 scroll-mt-8">
          <HomeModeSelector />
        </div>

        <div className="mt-8 matchday-panel p-6">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-accent-green">
            How It Works
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Step
              num="1"
              title="Click the Pitch"
              desc="Recruit directly from the team sheet — click any open position."
            />
            <Step
              num="2"
              title="Choose One of Two"
              desc="Pick between two real players with tight ratings — the other walks away."
            />
            <Step
              num="3"
              title="Quest for 27-0"
              desc="Simulate a full Super League season. Can your squad win every game?"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/leaderboard"
              className="text-sm text-gray-500 transition hover:text-white"
            >
              View Leaderboard →
            </Link>
            <Link
              href="/showcase"
              className="text-sm text-gray-500 transition hover:text-white"
            >
              Player Showcase →
            </Link>
          </div>
          <JoeMellorEasterEgg />
        </div>
      </div>
    </div>
  );
}

function Step({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <span className="font-display text-2xl font-black text-pitch-600/80">
        {num}
      </span>
      <h4 className="mt-1 font-display font-bold">{title}</h4>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </div>
  );
}
