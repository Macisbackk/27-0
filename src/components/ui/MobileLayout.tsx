"use client";

import {
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { GameButton } from "@/components/ui/GameButton";
import { MOBILE, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface CollapsibleDetailsProps {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** Priority-3 content: collapsed on mobile by default, expandable. */
export function CollapsibleDetails({
  summary,
  children,
  defaultOpen = false,
  className = "",
}: CollapsibleDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`w-full min-w-0 rounded-lg border border-pitch-700/40 bg-pitch-950/40 ${className}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className={`${MOBILE.touchTarget} cursor-pointer list-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-pitch-400 marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="text-pitch-500">
            {open ? "▾" : "▸"}
          </span>
          {summary}
        </span>
      </summary>
      <div className={`border-t border-pitch-700/30 px-3 py-2 ${SPACING.stackSm}`}>
        {children}
      </div>
    </details>
  );
}

interface MobileSectionHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  /** When true, subtitle is hidden below sm (priority 3). */
  collapseSubtitleOnMobile?: boolean;
  /** Default left — pass `"center"` for legacy centred headers. */
  align?: "left" | "center";
  className?: string;
}

export function MobileSectionHeader({
  label,
  title,
  subtitle,
  collapseSubtitleOnMobile = true,
  align = "left",
  className = "",
}: MobileSectionHeaderProps) {
  return (
    <header
      className={`${MOBILE.sectionHeader} ${
        align === "center" ? "text-center" : "text-left"
      } ${className}`.trim()}
    >
      {label ? (
        <p className={`${TYPO.keyLabel} text-pitch-500`}>
          {label}
        </p>
      ) : null}
      <h2 className={`${MOBILE.sectionTitle} mt-0.5 text-white`}>{title}</h2>
      {subtitle ? (
        <p
          className={`mt-1 ${TYPO.bodySm} text-pitch-400 ${
            collapseSubtitleOnMobile ? MOBILE.secondaryCopy : ""
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

interface MobilePageHeaderProps {
  title: string;
  context?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Left-aligned page title + optional context / trailing actions. */
export function MobilePageHeader({
  title,
  context,
  actions,
  className = "",
}: MobilePageHeaderProps) {
  return (
    <header className={`${MOBILE.pageHeader} ${className}`.trim()}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className={MOBILE.pageHeaderTitle}>{title}</h1>
          {context ? (
            <div className={MOBILE.pageHeaderContext}>{context}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

interface MobileSectionProps {
  children: ReactNode;
  /** Drop padding / border / background — content only. */
  flush?: boolean;
  className?: string;
  as?: "div" | "section" | "article";
}

/** Level-2 surface for meaningful mobile content groups. */
export function MobileSection({
  children,
  flush = false,
  className = "",
  as: Tag = "section",
}: MobileSectionProps) {
  return (
    <Tag
      className={`${flush ? MOBILE.sectionFlush : MOBILE.section} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

interface CompactMetricRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export function CompactMetricRow({
  label,
  value,
  className = "",
}: CompactMetricRowProps) {
  return (
    <div className={`${MOBILE.metricRow} ${className}`.trim()}>
      <span className={MOBILE.metricRowLabel}>{label}</span>
      <span className={MOBILE.metricRowValue}>{value}</span>
    </div>
  );
}

interface CompactFixtureCardProps {
  children: ReactNode;
  accentColor?: string;
  className?: string;
}

export function CompactFixtureCard({
  children,
  accentColor,
  className = "",
}: CompactFixtureCardProps) {
  const style = accentColor
    ? ({ ["--card-accent"]: accentColor } as CSSProperties)
    : undefined;
  return (
    <div className={`${MOBILE.fixtureCard} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

interface CompactResultRowProps {
  home: ReactNode;
  away: ReactNode;
  score: ReactNode;
  className?: string;
}

export function CompactResultRow({
  home,
  away,
  score,
  className = "",
}: CompactResultRowProps) {
  return (
    <div className={`${MOBILE.resultRow} ${className}`.trim()}>
      <span className="min-w-0 truncate text-left text-sm font-medium text-white">
        {home}
      </span>
      <span className={MOBILE.resultRowScore}>{score}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-white">
        {away}
      </span>
    </div>
  );
}

interface ResponsiveInfoGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

/** Compact priority-2 stats grid. */
export function ResponsiveInfoGrid({
  children,
  cols = 2,
  className = "",
}: ResponsiveInfoGridProps) {
  const colClass =
    cols === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : cols === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";
  return (
    <div className={`grid ${colClass} gap-2 sm:gap-3 ${MOBILE.minZero} ${className}`}>
      {children}
    </div>
  );
}

interface CompactInfoCardProps {
  children: ReactNode;
  className?: string;
}

/** Priority-2 compact summary card — not a nested decorative box. */
export function CompactInfoCard({
  children,
  className = "",
}: CompactInfoCardProps) {
  return (
    <div className={`compact-info-card ${MOBILE.compactCard} ${className}`}>
      {children}
    </div>
  );
}

interface MobileDataRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export function MobileDataRow({
  label,
  value,
  className = "",
}: MobileDataRowProps) {
  return (
    <div className={`mobile-data-row ${className}`}>
      <span className="mobile-data-row__label">{label}</span>
      <span className="mobile-data-row__value">{value}</span>
    </div>
  );
}

interface ContentBreakoutProps {
  children: ReactNode;
  className?: string;
  /** Accessible name for the scroll region. */
  label?: string;
}

/** Local horizontal scroll for brackets/tables — page stays document-scroll. */
export function ContentBreakout({
  children,
  className = "",
  label = "Scrollable content",
}: ContentBreakoutProps) {
  return (
    <div
      className={`content-breakout ${className}`}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

interface MobilePrimaryActionProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "theme" | "secondary" | "danger";
  className?: string;
}

export function MobilePrimaryAction({
  label,
  onClick,
  disabled,
  variant = "theme",
  className = "",
}: MobilePrimaryActionProps) {
  return (
    <GameButton
      variant={variant}
      size="md"
      className={`min-h-[var(--mobile-tap-target)] w-full sm:w-auto ${className}`}
      disabled={disabled}
      onClick={() => {
        playUiClick();
        onClick();
      }}
    >
      {label}
    </GameButton>
  );
}

interface StickyActionBarProps {
  children: ReactNode;
  /** Sit above Manager Mode bottom nav. */
  aboveNav?: boolean;
  className?: string;
  /** Hide on desktop (default true). */
  mobileOnly?: boolean;
  /** Render via root portal — escapes overflow/transform ancestors. */
  portal?: boolean;
}

/**
 * Shared mobile primary-action bar. Respects safe-area; does not create a
 * nested scroll container. Pair with content bottom padding tokens.
 */
export function StickyActionBar({
  children,
  aboveNav = false,
  className = "",
  mobileOnly = true,
  portal = false,
}: StickyActionBarProps) {
  const bar = (
    <div
      className={`mobile-action-bar ${aboveNav ? "mobile-action-bar--above-nav" : ""} ${
        mobileOnly ? "sm:hidden" : ""
      } ${className}`.trim()}
      role="toolbar"
    >
      <div className="mobile-action-bar__inner">{children}</div>
    </div>
  );

  if (portal) return <BodyPortal>{bar}</BodyPortal>;
  return bar;
}

/** Alias — prefer this name in mobile layout docs / new call sites. */
export const MobileActionBar = StickyActionBar;
