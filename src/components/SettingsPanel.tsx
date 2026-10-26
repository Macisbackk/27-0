"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { sendPasswordResetEmail } from "@/lib/auth";
import { isSoundMuted, playUiClick, toggleSoundMuted } from "@/lib/sound";
import {
  getNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
  setNormalEraVariant,
} from "@/lib/storage/preferences";
import { getActiveTheme, UI_THEME_CHANGED_EVENT } from "@/lib/storage/ui-theme-store";
import { resetCareerStats } from "@/lib/storage/stats";
import { getQuickSpins, setQuickSpins } from "@/lib/storage/spin-settings";
import { InstallAppCard } from "@/components/InstallAppCard";
import { SHOW_TIP_LINKS } from "@/lib/native/platform";
import { GameButton } from "@/components/ui/GameButton";
import { TYPO } from "@/lib/ui/typography";
import { GAME_VERSION } from "../../data/version";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";
import { unhideCoach, useHiddenCoachesList } from "@/lib/storage/hidden-coaches";
import { PitchHero } from "@/components/ui/PitchHero";

const SUGGESTIONS_MAIL = contactMailto("27-0 Suggestion");
const REPORT_MAIL = contactMailto("27-0 Report a player or content");
const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const X_URL = "https://x.com/27and0";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="w-full" aria-labelledby={`settings-${title}`}>
      <h2 id={`settings-${title}`} className={`mb-2 px-1 text-left ${TYPO.sectionLabel}`}>
        {title}
      </h2>
      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/70">
        {children}
      </div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-3 text-left">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-snug text-gray-400">{hint}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

function LinkRow({ href, label, hint, external = false }: { href: string; label: string; hint?: string; external?: boolean }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-gray-400">{hint}</span> : null}
      </span>
      <span aria-hidden className="text-lg text-[color:var(--fl-muted)]">
        {external ? "↗" : "›"}
      </span>
    </>
  );
  const cls =
    "flex min-h-[56px] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-theme-primary/60";
  return external ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls} onClick={() => playUiClick()}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} onClick={() => playUiClick()}>
      {inner}
    </Link>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-7 w-12 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60 ${
        on ? "border-theme-primary/60 bg-theme-primary" : "border-white/15 bg-pitch-800"
      }`}
    >
      <span
        className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border border-white/10 bg-pitch-950 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
            value === o.id ? "bg-theme-primary text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPanel() {
  const { loading, isLoggedIn, coachName, email, signOut } = useAuth();
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [era, setEra] = useState(false);
  const [quickSpins, setQuickSpinsOn] = useState(false);
  const [themeName, setThemeName] = useState("Default");
  const [resetState, setResetState] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [mailState, setMailState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const hiddenCoaches = useHiddenCoachesList();

  useEffect(() => {
    setMuted(isSoundMuted());
    setEra(getNormalEraVariant());
    setQuickSpinsOn(getQuickSpins());
    setThemeName(getActiveTheme().label);
    setReady(true);
    const onTheme = () => setThemeName(getActiveTheme().label);
    const onEra = (e: Event) => {
      const detail = (e as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setEra(detail.eraMode);
    };
    window.addEventListener(UI_THEME_CHANGED_EVENT, onTheme);
    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onEra);
    return () => {
      window.removeEventListener(UI_THEME_CHANGED_EVENT, onTheme);
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onEra);
    };
  }, []);

  const onReset = async () => {
    if (resetState !== "confirm") {
      setResetState("confirm");
      return;
    }
    setResetState("busy");
    const result = await resetCareerStats();
    setResetState(result.ok ? "done" : "error");
  };

  const onPasswordEmail = async () => {
    if (!email) return;
    setMailState("busy");
    const result = await sendPasswordResetEmail(email);
    setMailState(result.ok ? "sent" : "error");
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <PitchHero
        eyebrow="Your game"
        title="Settings"
        icon={
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </>
        }
      />

      <InstallAppCard />

      <Group title="Game">
        <Row label="Sound" hint="Match sounds, spins and menus.">
          {ready ? (
            <Switch
              on={!muted}
              label="Sound"
              onToggle={() => {
                const nowMuted = toggleSoundMuted();
                setMuted(nowMuted);
                if (!nowMuted) playUiClick();
              }}
            />
          ) : null}
        </Row>
        <Row label="Quick spins" hint="Shorter reel (about 1s). Reduced motion skips it.">
          {ready ? (
            <Switch
              on={quickSpins}
              label="Quick spins"
              onToggle={() => {
                playUiClick();
                setQuickSpins(!quickSpins);
                setQuickSpinsOn(!quickSpins);
              }}
            />
          ) : null}
        </Row>
        <Row label="Show first" hint="Which mode your stats and leaderboards open on.">
          {ready ? (
            <Segmented
              label="Show first"
              value={era ? "era" : "current"}
              options={[
                { id: "current", label: "Classic" },
                { id: "era", label: "Era Classic" },
              ]}
              onChange={(id) => {
                playUiClick();
                setNormalEraVariant(id === "era");
                setEra(id === "era");
              }}
            />
          ) : null}
        </Row>
        <LinkRow href="/store" label="Theme" hint={`${themeName} · change it in the Store`} />
      </Group>

      <Group title="Account">
        {loading ? (
          <Row label="Checking your account…" />
        ) : isLoggedIn ? (
          <>
            <Row label={coachName ?? "Coach"} hint={email ?? undefined} />
            <LinkRow href="/profile#achievements" label="Coach Profile" />
            <Row
              label="Password"
              hint={
                mailState === "sent"
                  ? "Reset link sent — check your inbox."
                  : mailState === "error"
                    ? "Couldn't send the email. Try again shortly."
                    : "We'll email you a link to set a new one."
              }
            >
              <GameButton
                variant="secondary"
                size="sm"
                fullWidth={false}
                disabled={mailState === "busy" || mailState === "sent" || !email}
                onClick={() => void onPasswordEmail()}
              >
                {mailState === "sent" ? "Sent" : "Email link"}
              </GameButton>
            </Row>
            <Row label="Log out" hint="Your progress stays saved to your account.">
              <GameButton variant="danger" size="sm" fullWidth={false} onClick={() => void signOut()}>
                Log out
              </GameButton>
            </Row>
            <LinkRow href="/delete-account" label="Delete account" hint="Permanently remove your account and online data." />
          </>
        ) : (
          <>
            <Row label="Playing as a guest" hint="Progress is saved on this device only." />
            <LinkRow href="/login" label="Log in or create an account" hint="Save progress online, join the leaderboards and bank a £100k welcome bonus." />
          </>
        )}
      </Group>

      {isLoggedIn || hiddenCoaches.length > 0 ? (
        <div id="hidden-coaches" className="scroll-mt-24">
          <Group title="Hidden coaches">
            {hiddenCoaches.length === 0 ? (
              <Row
                label="No hidden coaches"
                hint="Tap the three-dot (⋯) button next to a coach on any leaderboard to hide them from your boards or report them."
              />
            ) : (
              hiddenCoaches.map((c) => (
                <Row key={c.userId} label={c.name} hint="Hidden from your leaderboards.">
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onClick={() => {
                      playUiClick();
                      unhideCoach(c.userId);
                    }}
                  >
                    Show
                  </GameButton>
                </Row>
              ))
            )}
          </Group>
        </div>
      ) : null}

      <Group title="Saved progress">
        <Row
          label="Reset career stats"
          hint={
            resetState === "confirm"
              ? "This clears your Classic stats and can't be undone. Leaderboard entries stay."
              : resetState === "done"
                ? isLoggedIn
                  ? "Classic stats reset everywhere."
                  : "Classic stats reset on this device."
                : resetState === "error"
                  ? "Couldn't reset. Try again."
                  : "Wins, records and squad stats. Manager Mode and Club Funds aren't affected."
          }
        >
          <div className="flex gap-1.5">
            {resetState === "confirm" ? (
              <GameButton variant="secondary" size="sm" fullWidth={false} onClick={() => setResetState("idle")}>
                Cancel
              </GameButton>
            ) : null}
            <GameButton
              variant="danger"
              size="sm"
              fullWidth={false}
              disabled={resetState === "busy" || resetState === "done"}
              onClick={() => void onReset()}
            >
              {resetState === "confirm" ? "Yes, reset" : "Reset"}
            </GameButton>
          </div>
        </Row>
        <LinkRow href="/profile" label="Career stats" hint="Your Classic record, in Coach Profile." />
      </Group>

      <Group title="Help & feedback">
        <LinkRow href="/#how-to-play" label="How to play" />
        <LinkRow href={SUGGESTIONS_MAIL} label="Send a suggestion" hint="Ideas and bug reports welcome." external />
        <LinkRow
          href={REPORT_MAIL}
          label="Report a player or content"
          hint={`Offensive names, cheating or anything else: ${CONTACT_EMAIL}. Or tap the three-dot (⋯) button next to a coach on a leaderboard.`}
          external
        />
        {SHOW_TIP_LINKS ? <LinkRow href={COFFEE_URL} label="Buy Me a Coffee" hint="Support 27-0." external /> : null}
        <LinkRow href={X_URL} label="Follow @27and0 on X" external />
        <LinkRow href="/privacy" label="Privacy policy" />
      </Group>

      <p className="px-2 text-center text-xs text-[color:var(--fl-muted)]">27-0 {GAME_VERSION}</p>
    </div>
  );
}
