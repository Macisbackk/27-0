import type { Metadata } from "next";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Privacy policy — 27-0",
  description: "What 27-0 stores, why, and how to delete it.",
};

const CONTACT = "twentysevenzero@yahoo.com";
const UPDATED = "22 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left">
      <h2 className="text-[17px] font-bold text-white">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--fl-muted)] [&_strong]:text-white">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <StandardPageShell compact>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <header className="py-2 text-center">
          <h1 className="text-[26px] font-bold text-white">Privacy policy</h1>
          <p className="mt-1 text-xs text-[color:var(--fl-muted)]">Last updated {UPDATED}</p>
        </header>

        <Section title="The short version">
          <p>
            27-0 is a free, unofficial fan-made rugby league game. We only keep what the game needs to work. We
            don&rsquo;t show ads, we don&rsquo;t sell your data and we don&rsquo;t track you across other apps or sites.
          </p>
        </Section>

        <Section title="If you play as a guest">
          <p>
            Your progress (squads, records, Manager Mode career, Club Funds, settings) is saved only on your device, in
            your browser or app storage. Nothing about you is sent to us. Clearing the app&rsquo;s data or your browser
            data removes it.
          </p>
        </Section>

        <Section title="If you create an account">
          <p>We store, in our database:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Your email address and a password</strong> (the password is stored only as a secure hash) so you
              can log in.
            </li>
            <li>
              <strong>Your coach name</strong>, which is shown on the public leaderboards.
            </li>
            <li>
              <strong>Your game progress</strong>: stats, records, leaderboard entries, Club Funds, Store items and
              your Manager Mode save, so they follow you between devices. The coach title and frame you wear are shown
              publicly on the leaderboards.
            </li>
          </ul>
          <p>
            We use your email only for logging in, confirming your account and password resets. We don&rsquo;t send
            marketing.
          </p>
        </Section>

        <Section title="Who handles the data">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong> hosts our database and logins.
            </li>
            <li>
              <strong>Vercel</strong> hosts the website and records anonymous page-view counts on the website (no
              cookies, no personal profile). The iPhone and Android apps don&rsquo;t record page views.
            </li>
          </ul>
          <p>They process data only to run the service for us.</p>
        </Section>

        <Section title="Your rights and deleting your data">
          <p>
            You can delete your account and everything stored with it at any time from{" "}
            <Link href="/delete-account" className="font-semibold text-theme-primary underline-offset-2 hover:underline">
              Delete account
            </Link>{" "}
            (also in Settings). You can also ask us for a copy of your data, to correct it or to delete it by emailing{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-theme-primary underline-offset-2 hover:underline">
              {CONTACT}
            </a>
            . We reply within 30 days.
          </p>
          <p>We keep account data until you delete your account. Leaderboard entries are removed with it.</p>
        </Section>

        <Section title="Children">
          <p>
            27-0 is suitable for all ages but isn&rsquo;t aimed at children under 13, and we don&rsquo;t knowingly
            collect their data. If you think a child has made an account, email us and we&rsquo;ll delete it.
          </p>
        </Section>

        <Section title="Not affiliated">
          <p>
            27-0 isn&rsquo;t affiliated with, endorsed by or connected to the Rugby Football League, Super League, any
            club, player or governing body. Names are used for fan entertainment only.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about privacy:{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-theme-primary underline-offset-2 hover:underline">
              {CONTACT}
            </a>
            . If we change this policy we&rsquo;ll update the date at the top.
          </p>
        </Section>
      </div>
    </StandardPageShell>
  );
}
