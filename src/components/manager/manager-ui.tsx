import type { ReactNode } from "react";
import type { InboxMessage, InboxMessageType, LatestNewsItem } from "@/lib/manager/types";
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

const INBOX_MESSAGE_STYLE: Record<
  InboxMessageType,
  {
    label: string;
    icon: string;
    badge: string;
    iconBox: string;
    card: string;
    accentBar: string;
  }
> = {
  transfer: {
    label: "Transfer Listed",
    icon: "£",
    badge: "border-accent-gold/50 bg-accent-gold/15 text-accent-gold",
    iconBox: "border-accent-gold/45 bg-accent-gold/20 text-accent-gold",
    card: "border-accent-gold/30 bg-accent-gold/[0.07]",
    accentBar: "bg-accent-gold",
  },
  transfer_offer_in: {
    label: "Incoming Bid",
    icon: "IN",
    badge: "border-emerald-400/45 bg-emerald-500/15 text-emerald-300",
    iconBox: "border-emerald-400/45 bg-emerald-500/20 text-emerald-200",
    card: "border-emerald-500/25 bg-emerald-500/[0.08]",
    accentBar: "bg-emerald-400",
  },
  transfer_offer_out: {
    label: "Bid Sent",
    icon: "OUT",
    badge: "border-sky-400/45 bg-sky-500/15 text-sky-300",
    iconBox: "border-sky-400/45 bg-sky-500/20 text-sky-200",
    card: "border-sky-500/25 bg-sky-500/[0.08]",
    accentBar: "bg-sky-400",
  },
  transfer_complete: {
    label: "Deal Complete",
    icon: "✓",
    badge: "border-theme-primary/45 bg-theme-primary/15 text-theme-primary",
    iconBox: "border-theme-primary/45 bg-theme-primary/20 text-theme-primary",
    card: "border-theme-primary/30 bg-theme-primary/[0.08]",
    accentBar: "bg-theme-primary",
  },
  sale: {
    label: "Player Sold",
    icon: "$",
    badge: "border-amber-400/45 bg-amber-500/15 text-amber-200",
    iconBox: "border-amber-400/45 bg-amber-500/20 text-amber-100",
    card: "border-amber-500/25 bg-amber-500/[0.08]",
    accentBar: "bg-amber-400",
  },
  contract: {
    label: "Contract",
    icon: "C",
    badge: "border-cyan-400/45 bg-cyan-500/15 text-cyan-200",
    iconBox: "border-cyan-400/45 bg-cyan-500/20 text-cyan-100",
    card: "border-cyan-500/25 bg-cyan-500/[0.08]",
    accentBar: "bg-cyan-400",
  },
  board: {
    label: "Board",
    icon: "B",
    badge: "border-orange-400/45 bg-orange-500/15 text-orange-200",
    iconBox: "border-orange-400/45 bg-orange-500/20 text-orange-100",
    card: "border-orange-500/25 bg-orange-500/[0.08]",
    accentBar: "bg-orange-400",
  },
  injury: {
    label: "Injury",
    icon: "+",
    badge: "border-red-400/45 bg-red-500/15 text-red-300",
    iconBox: "border-red-400/45 bg-red-500/20 text-red-200",
    card: "border-red-500/30 bg-red-500/[0.09]",
    accentBar: "bg-red-400",
  },
  release: {
    label: "Released",
    icon: "×",
    badge: "border-rose-400/45 bg-rose-500/15 text-rose-300",
    iconBox: "border-rose-400/45 bg-rose-500/20 text-rose-200",
    card: "border-rose-500/30 bg-rose-500/[0.09]",
    accentBar: "bg-rose-400",
  },
  cup_draw: {
    label: "Cup Draw",
    icon: "CC",
    badge: "border-accent-gold/55 bg-accent-gold/18 text-accent-gold",
    iconBox: "border-accent-gold/50 bg-accent-gold/25 text-accent-gold",
    card: "border-accent-gold/35 bg-accent-gold/[0.1] ring-1 ring-accent-gold/15",
    accentBar: "bg-accent-gold",
  },
  season_reward: {
    label: "Season End",
    icon: "★",
    badge: "border-violet-400/45 bg-violet-500/15 text-violet-200",
    iconBox: "border-violet-400/45 bg-violet-500/20 text-violet-100",
    card: "border-violet-500/30 bg-violet-500/[0.09] ring-1 ring-violet-400/15",
    accentBar: "bg-violet-400",
  },
  youth_intake: {
    label: "Youth Intake",
    icon: "Y",
    badge: "border-lime-400/45 bg-lime-500/15 text-lime-200",
    iconBox: "border-lime-400/45 bg-lime-500/20 text-lime-100",
    card: "border-lime-500/25 bg-lime-500/[0.08]",
    accentBar: "bg-lime-400",
  },
  reserve_report: {
    label: "Reserve Report",
    icon: "R",
    badge: "border-indigo-400/40 bg-indigo-500/12 text-indigo-200",
    iconBox: "border-indigo-400/40 bg-indigo-500/18 text-indigo-100",
    card: "border-indigo-500/22 bg-indigo-500/[0.07]",
    accentBar: "bg-indigo-400",
  },
  reserve_callup: {
    label: "Call-Up",
    icon: "↑",
    badge: "border-teal-400/45 bg-teal-500/15 text-teal-200",
    iconBox: "border-teal-400/45 bg-teal-500/20 text-teal-100",
    card: "border-teal-500/25 bg-teal-500/[0.08]",
    accentBar: "bg-teal-400",
  },
  reserve_return: {
    label: "Returned",
    icon: "↓",
    badge: "border-slate-400/40 bg-slate-500/12 text-slate-300",
    iconBox: "border-slate-400/40 bg-slate-500/18 text-slate-200",
    card: "border-slate-500/22 bg-slate-500/[0.07]",
    accentBar: "bg-slate-400",
  },
  fixture: {
    label: "Fixture",
    icon: "F",
    badge: "border-blue-400/40 bg-blue-500/12 text-blue-200",
    iconBox: "border-blue-400/40 bg-blue-500/18 text-blue-100",
    card: "border-blue-500/22 bg-blue-500/[0.07]",
    accentBar: "bg-blue-400",
  },
  news: {
    label: "Club News",
    icon: "N",
    badge: "border-pitch-500/45 bg-pitch-800/70 text-pitch-300",
    iconBox: "border-pitch-500/45 bg-pitch-800/80 text-pitch-200",
    card: "border-pitch-600/35 bg-pitch-900/50",
    accentBar: "bg-pitch-500",
  },
  general: {
    label: "Notice",
    icon: "i",
    badge: "border-pitch-600/45 bg-pitch-800/60 text-pitch-400",
    iconBox: "border-pitch-600/45 bg-pitch-800/70 text-pitch-300",
    card: "border-pitch-700/40 bg-pitch-950/40",
    accentBar: "bg-pitch-600",
  },
};

export function ManagerInboxBadge({ type }: { type: InboxMessageType }) {
  const style = INBOX_MESSAGE_STYLE[type];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
    >
      {style.label}
    </span>
  );
}

export function inboxMessageAccent(
  type: InboxMessageType
): "gold" | "primary" | "red" | "amber" | "sky" | undefined {
  if (
    type === "transfer" ||
    type === "sale" ||
    type === "cup_draw"
  ) {
    return "gold";
  }
  if (type === "transfer_offer_in") return "primary";
  if (type === "transfer_offer_out" || type === "contract") return "sky";
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

export function ManagerInboxMessageCard({
  message,
  children,
  compact = false,
}: {
  message: InboxMessage;
  children?: ReactNode;
  compact?: boolean;
}) {
  const style = INBOX_MESSAGE_STYLE[message.type];

  if (compact) {
    return (
      <div
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 opacity-75 ${style.card}`}
      >
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${style.iconBox}`}
          aria-hidden
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ManagerInboxBadge type={message.type} />
            <span className="text-[10px] text-pitch-500">Wk {message.gameWeek}</span>
          </div>
          <p className={`mt-1 ${TYPO.bodySm} font-medium text-pitch-200`}>
            {message.title}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`relative overflow-hidden rounded-xl border ${SPACING.cardPadding} ${style.card}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`}
        aria-hidden
      />
      <div className="flex gap-3 pl-2">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${style.iconBox}`}
          aria-hidden
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ManagerInboxBadge type={message.type} />
            <span className="text-xs text-pitch-500">Week {message.gameWeek}</span>
            {!message.read && (
              <span className="rounded-full bg-theme-primary/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-primary">
                New
              </span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-white">{message.title}</h3>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>{message.body}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </article>
  );
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

/** Match prediction copy → colour by favourability. */
export function matchPredictionTone(prediction: string): ManagerValueTone {
  if (
    prediction.includes("comfortably") ||
    prediction.includes("Favourites")
  ) {
    return "primary";
  }
  if (prediction.includes("Tight")) return "amber";
  return "red";
}

export function leaguePositionTone(position: number): ManagerValueTone {
  if (position <= 3) return "gold";
  if (position <= 6) return "primary";
  if (position >= 12) return "red";
  return "default";
}
