"use client";

import type { CSSProperties, ReactNode } from "react";
import { TYPO } from "@/lib/ui/typography";
import { managerPillClass, type ManagerPillTone } from "@/lib/manager/managerSurfaces";

export type ManagerPlayerCardVariant = "contract" | "reserve";

/**
 * Shared Manager Mode player card shell.
 *
 * Squad → Contracts is the visual reference: both variants render the same
 * ledger surface, rating badge, name treatment and information rows. Variants
 * only change which sections are populated, never the card chrome.
 */
interface ManagerPlayerCardProps {
  variant: ManagerPlayerCardVariant;
  children: ReactNode;
  /** Soft accent wash for urgent cards (expiring deals, renewals due). */
  accent?: "gold" | "none";
  /** Club identity border — set on Reserve cards, never overridden by theme green. */
  clubStyle?: CSSProperties;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ManagerPlayerCard({
  variant,
  children,
  accent = "none",
  clubStyle,
  interactive = false,
  onClick,
  className = "",
}: ManagerPlayerCardProps) {
  const Tag = onClick ? "button" : "article";
  const classes = [
    "manager-player-card",
    `manager-player-card--${variant}`,
    clubStyle ? "manager-player-card--club-accent" : "",
    accent === "gold" ? "manager-player-card--accent-gold" : "",
    interactive || onClick ? "manager-player-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      className={classes}
      style={clubStyle}
      onClick={onClick}
      type={Tag === "button" ? "button" : undefined}
    >
      {children}
    </Tag>
  );
}

interface ManagerPlayerCardHeaderProps {
  /** Displayed in the square badge — current ability, never potential. */
  rating: number;
  name: string;
  /** e.g. "PROP • ENG • Age 19" */
  meta: string;
  /** Status chip aligned to the trailing edge (Contracts) or below (Reserve). */
  trailing?: ReactNode;
  /** Chips shown beside the name (review flags). */
  nameAdornments?: ReactNode;
  /** Reserve cards wrap names over two lines; Contracts keeps a single line. */
  wrapName?: boolean;
}

export function ManagerPlayerCardHeader({
  rating,
  name,
  meta,
  trailing,
  nameAdornments,
  wrapName = false,
}: ManagerPlayerCardHeaderProps) {
  return (
    <div className="manager-player-card__header">
      <div className="manager-player-card__identity">
        <span className="manager-player-card__rating-badge">{rating}</span>
        <div className="manager-player-card__identity-text">
          <div className="manager-player-card__name-row">
            <p
              className={
                wrapName
                  ? "manager-player-card__name manager-player-card__name--wrap"
                  : "manager-player-card__name"
              }
              title={name}
            >
              {name}
            </p>
            {nameAdornments}
          </div>
          <p className={`manager-player-card__meta ${TYPO.bodySm}`}>{meta}</p>
        </div>
      </div>
      {trailing}
    </div>
  );
}

/** Named zone so every card stacks its sections in the same order. */
export function ManagerPlayerCardSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`manager-player-card__section ${className}`.trim()}>
      {children}
    </div>
  );
}

interface PlayerRatingPotentialRowProps {
  currentRating: number;
  potential?: number | null;
  /** Optional supporting chip, e.g. lifetime growth since signing. */
  supporting?: ReactNode;
}

/**
 * Current ability leads; potential is a smaller supporting figure so it is never
 * mistaken for match strength.
 */
export function PlayerRatingPotentialRow({
  currentRating,
  potential,
  supporting,
}: PlayerRatingPotentialRowProps) {
  return (
    <div className="manager-player-card__ratings">
      <span className="manager-player-card__rating-primary">
        <span className="manager-player-card__rating-label">Current Rating</span>
        <span className="manager-player-card__rating-value">{currentRating}</span>
      </span>
      {potential != null && (
        <span className="manager-player-card__rating-secondary">
          <span className="manager-player-card__rating-label">Potential</span>
          <span className="manager-player-card__rating-value-sm">{potential}</span>
        </span>
      )}
      {supporting}
    </div>
  );
}

interface PlayerContractSummaryProps {
  /** Pre-formatted expiry, e.g. "End of 2028" or "Not under contract". */
  expiry: string;
  wage?: string | null;
  value?: string | null;
  listed?: boolean;
}

export function PlayerContractSummary({
  expiry,
  wage,
  value,
  listed = false,
}: PlayerContractSummaryProps) {
  return (
    <dl className="manager-player-card__facts">
      <div className="manager-player-card__fact">
        <dt>Contract</dt>
        <dd>{expiry}</dd>
      </div>
      {wage && (
        <div className="manager-player-card__fact">
          <dt>Wage</dt>
          <dd>{wage}</dd>
        </div>
      )}
      {value && (
        <div className="manager-player-card__fact">
          <dt>Value</dt>
          <dd>{value}</dd>
        </div>
      )}
      {listed && (
        <div className="manager-player-card__fact">
          <dt>Transfer</dt>
          <dd className="text-accent-gold">Listed</dd>
        </div>
      )}
    </dl>
  );
}

export interface PlayerAvailabilityStatusItem {
  label: string;
  tone: ManagerPillTone;
  title?: string;
}

export function PlayerAvailabilityStatus({
  items,
}: {
  items: PlayerAvailabilityStatusItem[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="manager-player-card__status">
      {items.map((item) => (
        <span
          key={`${item.label}-${item.tone}`}
          className={managerPillClass(item.tone)}
          title={item.title}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Bottom-pinned action zone so buttons stay level across a row of cards. */
export function ManagerPlayerCardActions({ children }: { children: ReactNode }) {
  return <div className="manager-player-card__actions">{children}</div>;
}

/** Equal-height responsive grid used for card collections. */
export function ManagerPlayerCardGrid({ children }: { children: ReactNode }) {
  return <div className="manager-player-card-grid">{children}</div>;
}
