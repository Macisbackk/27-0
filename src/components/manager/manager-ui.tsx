import type { CSSProperties, ReactNode } from "react";
import type { InboxMessage, InboxMessageType, LatestNewsItem, ManagerCareer } from "@/lib/manager/types";
import { GameButton } from "@/components/ui/GameButton";
import { formatWage } from "@/lib/manager/managerContracts";
import {
  REVENUE_SPLIT,
  getOperatingBalance,
  getTransferBudget,
} from "@/lib/manager/managerFinance";
import { playUiClick } from "@/lib/sound";
import { CARD, MANAGER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { managerSectionAccentClass } from "@/lib/manager/managerSurfaces";

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
  "text-[11px] font-semibold uppercase tracking-wider text-pitch-500 sm:text-[10px]";

export function ManagerPage({
  wide = false,
  children,
  className = "",
}: {
  wide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${wide ? MANAGER.pageWide : MANAGER.page} ${className}`}>
      {children}
    </div>
  );
}

/** Full-width sticky back bar for manager overlays (match review, etc.). */
export function ManagerMobileBackBar({
  label = "Back",
  onBack,
}: {
  label?: string;
  onBack: () => void;
}) {
  const handleBack = () => {
    playUiClick();
    onBack();
  };

  return (
    <div className="sticky top-0 z-30 -mx-5 mb-4 border-b border-theme-primary/20 bg-gradient-to-b from-pitch-950/98 to-pitch-950/90 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-md sm:-mx-0 sm:rounded-none">
      <button
        type="button"
        onClick={handleBack}
        className="btn-press flex w-full min-h-[52px] items-center gap-3 px-5 py-3.5 text-left transition hover:bg-theme-primary/8 active:bg-theme-primary/12 sm:min-h-[48px] sm:px-4 sm:py-3"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-primary/35 bg-theme-primary/12 text-base font-bold leading-none text-theme-primary"
          aria-hidden
        >
          ←
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            Manager
          </span>
          <span className="block font-display text-sm font-bold uppercase tracking-wide text-theme-primary">
            {label}
          </span>
        </span>
      </button>
    </div>
  );
}

export function ManagerViewHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className={TYPO.viewTitle}>{title}</h1>
        {subtitle ? (
          <p className={`mt-1 ${TYPO.managerBody}`}>{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ManagerStatGrid({
  cols = 2,
  className = "",
  children,
}: {
  cols?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}) {
  const gridClass =
    cols === 4
      ? MANAGER.statGrid4
      : cols === 3
        ? MANAGER.statGrid3
        : MANAGER.statGrid2;
  return <div className={`${gridClass} ${className}`}>{children}</div>;
}

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
  style,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  variant?: "base" | "elevated" | "inset" | "featured";
  accent?: "gold" | "primary" | "red" | "amber" | "sky";
  className?: string;
  style?: CSSProperties;
}) {
  const surface =
    variant === "elevated"
      ? CARD.elevated
      : variant === "inset"
        ? CARD.inset
        : variant === "featured"
          ? `${CARD.elevated} ${CARD.featured}`
          : CARD.base;

  const accentBorder = accent ? managerSectionAccentClass(accent) : "";

  return (
    <div
      className={`${surface} ${SPACING.cardPaddingMobile} ${accentBorder} ${className}`}
      style={style}
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
    accentBar: string;
  }
> = {
  transfer: {
    label: "Transfer Listed",
    icon: "£",
    badge: "border-accent-gold/50 bg-accent-gold/15 text-accent-gold",
    iconBox: "border-accent-gold/45 bg-accent-gold/20 text-accent-gold",
    accentBar: "bg-accent-gold",
  },
  transfer_offer_in: {
    label: "Incoming Bid",
    icon: "IN",
    badge: "border-emerald-400/45 bg-emerald-500/15 text-emerald-300",
    iconBox: "border-emerald-400/45 bg-emerald-500/20 text-emerald-200",
    accentBar: "bg-emerald-400",
  },
  transfer_offer_out: {
    label: "Bid Sent",
    icon: "OUT",
    badge: "border-sky-400/45 bg-sky-500/15 text-sky-300",
    iconBox: "border-sky-400/45 bg-sky-500/20 text-sky-200",
    accentBar: "bg-sky-400",
  },
  transfer_complete: {
    label: "Deal Complete",
    icon: "✓",
    badge: "border-theme-primary/45 bg-theme-primary/15 text-theme-primary",
    iconBox: "border-theme-primary/45 bg-theme-primary/20 text-theme-primary",
    accentBar: "bg-theme-primary",
  },
  sale: {
    label: "Player Sold",
    icon: "$",
    badge: "border-amber-400/45 bg-amber-500/15 text-amber-200",
    iconBox: "border-amber-400/45 bg-amber-500/20 text-amber-100",
    accentBar: "bg-amber-400",
  },
  contract: {
    label: "Contract",
    icon: "C",
    badge: "border-cyan-400/45 bg-cyan-500/15 text-cyan-200",
    iconBox: "border-cyan-400/45 bg-cyan-500/20 text-cyan-100",
    accentBar: "bg-cyan-400",
  },
  board: {
    label: "Board",
    icon: "B",
    badge: "border-orange-400/45 bg-orange-500/15 text-orange-200",
    iconBox: "border-orange-400/45 bg-orange-500/20 text-orange-100",
    accentBar: "bg-orange-400",
  },
  injury: {
    label: "Injury",
    icon: "+",
    badge: "border-red-400/45 bg-red-500/15 text-red-300",
    iconBox: "border-red-400/45 bg-red-500/20 text-red-200",
    accentBar: "bg-red-400",
  },
  release: {
    label: "Released",
    icon: "×",
    badge: "border-rose-400/45 bg-rose-500/15 text-rose-300",
    iconBox: "border-rose-400/45 bg-rose-500/20 text-rose-200",
    accentBar: "bg-rose-400",
  },
  cup_draw: {
    label: "Cup Draw",
    icon: "CC",
    badge: "border-accent-gold/55 bg-accent-gold/18 text-accent-gold",
    iconBox: "border-accent-gold/50 bg-accent-gold/25 text-accent-gold",
    accentBar: "bg-accent-gold",
  },
  season_reward: {
    label: "Season End",
    icon: "★",
    badge: "border-violet-400/45 bg-violet-500/15 text-violet-200",
    iconBox: "border-violet-400/45 bg-violet-500/20 text-violet-100",
    accentBar: "bg-violet-400",
  },
  youth_intake: {
    label: "Youth Intake",
    icon: "Y",
    badge: "border-lime-400/45 bg-lime-500/15 text-lime-200",
    iconBox: "border-lime-400/45 bg-lime-500/20 text-lime-100",
    accentBar: "bg-lime-400",
  },
  retirement: {
    label: "Retirement",
    icon: "R",
    badge: "border-stone-400/45 bg-stone-500/15 text-stone-200",
    iconBox: "border-stone-400/45 bg-stone-500/20 text-stone-100",
    accentBar: "bg-stone-400",
  },
  reserve_report: {
    label: "Reserve Report",
    icon: "R",
    badge: "border-indigo-400/40 bg-indigo-500/12 text-indigo-200",
    iconBox: "border-indigo-400/40 bg-indigo-500/18 text-indigo-100",
    accentBar: "bg-indigo-400",
  },
  reserve_callup: {
    label: "Call-Up",
    icon: "↑",
    badge: "border-teal-400/45 bg-teal-500/15 text-teal-200",
    iconBox: "border-teal-400/45 bg-teal-500/20 text-teal-100",
    accentBar: "bg-teal-400",
  },
  reserve_return: {
    label: "Returned",
    icon: "↓",
    badge: "border-slate-400/40 bg-slate-500/12 text-slate-300",
    iconBox: "border-slate-400/40 bg-slate-500/18 text-slate-200",
    accentBar: "bg-slate-400",
  },
  fixture: {
    label: "Fixture",
    icon: "F",
    badge: "border-blue-400/40 bg-blue-500/12 text-blue-200",
    iconBox: "border-blue-400/40 bg-blue-500/18 text-blue-100",
    accentBar: "bg-blue-400",
  },
  news: {
    label: "Club News",
    icon: "N",
    badge: "border-pitch-500/45 bg-pitch-800/70 text-pitch-300",
    iconBox: "border-pitch-500/45 bg-pitch-800/80 text-pitch-200",
    accentBar: "bg-pitch-500",
  },
  general: {
    label: "Notice",
    icon: "i",
    badge: "border-pitch-600/45 bg-pitch-800/60 text-pitch-400",
    iconBox: "border-pitch-600/45 bg-pitch-800/70 text-pitch-300",
    accentBar: "bg-pitch-600",
  },
};

export function ManagerInboxBadge({ type }: { type: InboxMessageType }) {
  const style = INBOX_MESSAGE_STYLE[type];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
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

function InboxMessageMeta({ message }: { message: InboxMessage }) {
  const hasOffer = message.offerAmount != null;
  const hasAsking = message.askingPrice != null;
  const hasPlayer = Boolean(message.playerName);
  const hasClub = Boolean(message.offerClub);

  if (!hasOffer && !hasAsking && !hasPlayer && !hasClub) return null;

  return (
    <div className={MANAGER.statGrid4}>
      {hasPlayer && (
        <ManagerStat label="Player" value={message.playerName!} tone="default" />
      )}
      {hasClub && (
        <ManagerStat label="Club" value={message.offerClub!} tone="muted" />
      )}
      {hasOffer && (
        <ManagerStat
          label="Offer"
          value={formatWage(message.offerAmount!)}
          tone="gold"
        />
      )}
      {hasAsking && (
        <ManagerStat
          label="Asking"
          value={formatWage(message.askingPrice!)}
          tone="gold"
        />
      )}
    </div>
  );
}

export function ManagerInboxActionFooter({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-pitch-700/50 pt-3">{children}</div>
  );
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
  const weekLabel = `Week ${message.gameWeek}`;

  if (compact) {
    return (
      <article
        className={`${CARD.inset} relative flex items-center gap-3 overflow-hidden ${SPACING.listItem} opacity-80`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`}
          aria-hidden
        />
        <span
          className={`ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold ${style.iconBox}`}
          aria-hidden
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ManagerInboxBadge type={message.type} />
            <span className={`${MANAGER_LABEL} text-pitch-500`}>{weekLabel}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-pitch-200">
            {message.title}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`${CARD.elevated} relative flex flex-col overflow-hidden`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`}
        aria-hidden
      />
      <div className={`flex flex-1 flex-col gap-3 ${SPACING.cardPaddingSm} pl-5 sm:pl-4`}>
        <header className="flex gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${style.iconBox}`}
            aria-hidden
          >
            {style.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <ManagerInboxBadge type={message.type} />
              <span className={`${MANAGER_LABEL} text-pitch-500`}>{weekLabel}</span>
              {!message.read && (
                <span className="rounded-full bg-theme-primary/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-primary">
                  New
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold leading-snug text-white">
              {message.title}
            </h3>
          </div>
        </header>

        <p
          className={`${TYPO.bodySm} whitespace-pre-line leading-relaxed text-pitch-300`}
        >
          {message.body}
        </p>

        <InboxMessageMeta message={message} />

        {children && (
          <ManagerInboxActionFooter>{children}</ManagerInboxActionFooter>
        )}
      </div>
    </article>
  );
}

export function ManagerClubFinancesPanel({
  career,
  collapsible = false,
}: {
  career: ManagerCareer;
  /** Hub: collapsed by default to reduce scroll depth. */
  collapsible?: boolean;
}) {
  const transfer = getTransferBudget(career);
  const operating = getOperatingBalance(career);
  const finance = career.managerFinance;
  const seasonTransfer = finance?.seasonTransferIncome ?? 0;
  const seasonOperating = finance?.seasonOperatingIncome ?? 0;

  const body = (
    <>
      <p className={`${TYPO.bodySm} text-pitch-400`}>
        Match income is split between the transfer fund and day-to-day club
        running costs.
      </p>
      <div className={`mt-3 ${MANAGER.statGrid3}`}>
        <ManagerStat
          label="Transfer fund"
          value={formatWage(transfer)}
          tone="gold"
          large
        />
        <ManagerStat
          label="Club operations"
          value={formatWage(operating)}
          tone="primary"
        />
        <ManagerStat
          label="Total reserves"
          value={formatWage(transfer + operating)}
          tone="muted"
        />
      </div>
      {(seasonTransfer > 0 || seasonOperating > 0) && (
        <div className={`mt-3 ${MANAGER.statGrid2}`}>
          <ManagerStat
            label="Earned this season → transfers"
            value={formatWage(seasonTransfer)}
            tone="gold"
          />
          <ManagerStat
            label="Earned this season → operations"
            value={formatWage(seasonOperating)}
            tone="primary"
          />
        </div>
      )}
      <details className="group mt-3">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between rounded-lg border border-pitch-700/50 bg-pitch-950/40 px-3 py-2 transition hover:border-pitch-500/50 [&::-webkit-details-marker]:hidden`}
        >
          <span className={`${TYPO.sectionLabel} text-pitch-300`}>
            How income is allocated
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-pitch-500 transition group-open:rotate-180"
            aria-hidden
          >
            Info
          </span>
        </summary>
        <div className={`mt-2 ${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <ul className={`space-y-1.5 ${TYPO.bodySm} text-pitch-400`}>
            {(Object.keys(REVENUE_SPLIT) as Array<keyof typeof REVENUE_SPLIT>).map(
              (key) => {
                const row = REVENUE_SPLIT[key];
                return (
                  <li key={key}>
                    <span className="text-pitch-300">{row.label}</span>
                    {" — "}
                    {Math.round(row.transfer * 100)}% transfer fund ·{" "}
                    {Math.round(row.operating * 100)}% club operations
                  </li>
                );
              }
            )}
          </ul>
        </div>
      </details>
    </>
  );

  if (collapsible) {
    return (
      <details className="group">
        <summary
          className={`${CARD.elevated} flex cursor-pointer list-none items-center justify-between gap-3 ${SPACING.cardPadding} [&::-webkit-details-marker]:hidden`}
        >
          <div className="min-w-0 text-left">
            <p className={TYPO.sectionLabel}>Club Finances</p>
            <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
              Transfer fund {formatWage(transfer)} · Ops {formatWage(operating)}
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-pitch-500 transition group-open:rotate-180">
            Expand
          </span>
        </summary>
        <div className={`mt-2 ${CARD.elevated} ${SPACING.cardPadding}`}>
          {body}
        </div>
      </details>
    );
  }

  return (
    <ManagerSectionCard title="Club Finances" variant="elevated" accent="gold">
      {body}
    </ManagerSectionCard>
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
