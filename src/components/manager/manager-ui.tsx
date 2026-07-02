import type { ReactNode } from "react";
import type { InboxMessageType, LatestNewsItem } from "@/lib/manager/types";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export type ManagerValueTone =
  | "default"
  | "primary"
  | "gold"
  | "red"
  | "amber"
  | "sky"
  | "muted";

const VALUE_TONE_CLASS: Record<ManagerValueTone, string> = {
  default: "font-semibold text-white",
  primary: "font-semibold text-theme-primary",
  gold: "font-semibold text-accent-gold",
  red: "font-semibold text-red-300",
  amber: "font-semibold text-amber-300",
  sky: "font-semibold text-sky-300",
  muted: "font-medium text-pitch-300",
};

const STAT_VALUE_LG: Record<ManagerValueTone, string> = {
  default: "text-lg font-bold text-white",
  primary: "text-lg font-bold text-theme-primary",
  gold: "text-lg font-bold text-accent-gold",
  red: "text-lg font-bold text-red-300",
  amber: "text-lg font-bold text-amber-300",
  sky: "text-lg font-bold text-sky-300",
  muted: "text-lg font-bold text-pitch-300",
};

export const MANAGER_LABEL =
  "text-[10px] font-semibold uppercase tracking-wider text-pitch-500";

export function ManagerFormStrip({
  results,
}: {
  results: ("W" | "L" | "D")[];
}) {
  if (results.length === 0) {
    return <span className="text-pitch-500">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {results.map((r, i) => (
        <span
          key={`${r}-${i}`}
          className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1 text-[10px] font-bold ${
            r === "W"
              ? "bg-theme-primary/20 text-theme-primary"
              : r === "L"
                ? "bg-red-500/20 text-red-300"
                : "bg-pitch-700/80 text-pitch-300"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

export function ManagerStat({
  label,
  value,
  tone = "default",
  large = false,
}: {
  label: string;
  value: string;
  tone?: ManagerValueTone;
  large?: boolean;
}) {
  return (
    <div>
      <p className={MANAGER_LABEL}>{label}</p>
      <p className={large ? `mt-0.5 ${STAT_VALUE_LG[tone]}` : `mt-0.5 ${VALUE_TONE_CLASS[tone]}`}>
        {value}
      </p>
    </div>
  );
}

export function ManagerInfoRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: ManagerValueTone;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
      <span className={`${TYPO.bodySm} text-pitch-500`}>{label}</span>
      <span className={`${TYPO.bodySm} text-right ${VALUE_TONE_CLASS[tone]}`}>
        {value}
      </span>
    </div>
  );
}

export function ManagerSectionCard({
  title,
  subtitle,
  children,
  variant = "base",
  accent,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  variant?: "base" | "elevated" | "inset" | "featured";
  accent?: "gold" | "primary" | "red" | "amber" | "sky";
  className?: string;
}) {
  const surface =
    variant === "elevated"
      ? CARD.elevated
      : variant === "inset"
        ? CARD.inset
        : variant === "featured"
          ? `${CARD.elevated} ${CARD.featured}`
          : CARD.base;

  const accentBorder =
    accent === "gold"
      ? "border-l-4 border-l-accent-gold/70"
      : accent === "primary"
        ? "border-l-4 border-l-theme-primary/70"
        : accent === "red"
          ? "border-l-4 border-l-red-400/70"
          : accent === "amber"
            ? "border-l-4 border-l-amber-400/70"
            : accent === "sky"
              ? "border-l-4 border-l-sky-400/70"
              : "";

  return (
    <div
      className={`${surface} ${SPACING.cardPadding} ${accentBorder} ${className}`}
    >
      {title && <p className={TYPO.sectionLabel}>{title}</p>}
      {subtitle && (
        <p className={`${title ? "mt-1" : ""} ${TYPO.bodySm} text-pitch-400`}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

const INBOX_BADGE: Record<
  InboxMessageType,
  { label: string; className: string }
> = {
  transfer: {
    label: "Transfer",
    className: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
  },
  transfer_offer_in: {
    label: "Incoming Offer",
    className: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
  },
  transfer_offer_out: {
    label: "Outgoing Offer",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  },
  transfer_complete: {
    label: "Deal Done",
    className: "border-theme-primary/40 bg-theme-primary/12 text-theme-primary",
  },
  sale: {
    label: "Sale",
    className: "border-accent-gold/45 bg-accent-gold/12 text-accent-gold",
  },
  contract: {
    label: "Contract",
    className: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  },
  board: {
    label: "Board",
    className: "border-amber-400/45 bg-amber-400/10 text-amber-300",
  },
  injury: {
    label: "Injury",
    className: "border-red-400/45 bg-red-500/12 text-red-300",
  },
  cup_draw: {
    label: "Cup Draw",
    className: "border-accent-gold/50 bg-accent-gold/15 text-accent-gold",
  },
  season_reward: {
    label: "Season Reward",
    className: "border-accent-gold/50 bg-accent-gold/15 text-accent-gold",
  },
  youth_intake: {
    label: "Youth",
    className: "border-theme-primary/40 bg-theme-primary/12 text-theme-primary",
  },
  reserve_report: {
    label: "Reserves",
    className: "border-pitch-500/40 bg-pitch-800/60 text-pitch-300",
  },
  reserve_callup: {
    label: "Call-Up",
    className: "border-theme-primary/40 bg-theme-primary/12 text-theme-primary",
  },
  reserve_return: {
    label: "Return",
    className: "border-pitch-500/40 bg-pitch-800/60 text-pitch-300",
  },
  release: {
    label: "Release",
    className: "border-red-400/40 bg-red-500/10 text-red-300",
  },
  fixture: {
    label: "Fixture",
    className: "border-theme-primary/35 bg-theme-primary/10 text-theme-primary",
  },
  news: {
    label: "News",
    className: "border-pitch-600/50 bg-pitch-800/50 text-pitch-300",
  },
  general: {
    label: "Notice",
    className: "border-pitch-600/50 bg-pitch-800/50 text-pitch-300",
  },
};

export function ManagerInboxBadge({ type }: { type: InboxMessageType }) {
  const badge = INBOX_BADGE[type];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function inboxMessageAccent(type: InboxMessageType): "gold" | "primary" | "red" | "amber" | "sky" | undefined {
  if (
    type === "transfer" ||
    type === "transfer_offer_in" ||
    type === "sale" ||
    type === "cup_draw" ||
    type === "season_reward"
  ) {
    return "gold";
  }
  if (type === "injury" || type === "release") return "red";
  if (type === "board") return "amber";
  if (
    type === "transfer_complete" ||
    type === "youth_intake" ||
    type === "reserve_callup"
  ) {
    return "primary";
  }
  return undefined;
}

const NEWS_TONE: Record<
  LatestNewsItem["type"],
  { dot: string; text: string }
> = {
  transfer: { dot: "bg-accent-gold", text: "text-pitch-100" },
  result: { dot: "bg-theme-primary", text: "text-pitch-100" },
  fixture: { dot: "bg-sky-400", text: "text-pitch-100" },
  reserve: { dot: "bg-pitch-400", text: "text-pitch-200" },
  cup: { dot: "bg-accent-gold", text: "text-pitch-100" },
  board: { dot: "bg-amber-400", text: "text-pitch-100" },
};

export function ManagerNewsItem({ item }: { item: LatestNewsItem }) {
  const tone = NEWS_TONE[item.type];
  return (
    <li className={`flex items-start gap-2 ${TYPO.bodySm}`}>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
        aria-hidden
      />
      <span className={tone.text}>{item.text}</span>
    </li>
  );
}

export function ManagerDeltaBadge({ delta }: { delta: number }) {
  const positive = delta > 0;
  return (
    <span
      className={`ml-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
        positive
          ? "bg-theme-primary/20 text-theme-primary"
          : "bg-red-500/20 text-red-300"
      }`}
    >
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}

export function boardConfidenceTone(confidence: number): ManagerValueTone {
  if (confidence >= 70) return "primary";
  if (confidence >= 45) return "default";
  return "red";
}

export function fanMoodTone(mood: number): ManagerValueTone {
  if (mood >= 70) return "primary";
  if (mood >= 45) return "default";
  return "amber";
}

export function leaguePositionTone(position: number): ManagerValueTone {
  if (position <= 3) return "gold";
  if (position <= 6) return "primary";
  if (position >= 12) return "red";
  return "default";
}
