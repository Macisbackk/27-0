import type { CSSProperties, ReactNode } from "react";

/**
 * The pitch look (the home Classic card's design, shared site-wide). Styles: src/styles/pitch.css.
 *
 *   PitchHero    a page's header / hero: theme-primary surface, mown stripes, faint icon,
 *                small eyebrow (+ dark pill badge), Anton headline, optional line and actions.
 *   PitchMark    the big faint watermark icon for any `.pitch-surface`.
 *   Class kit    `.pitch-surface`, `.pitch-cta` (black button with ▸), `.pitch-seg` (dark track,
 *                white active), `.pitch-pill` (dark badge), `.pitch-title`, `.pitch-eyebrow`.
 *
 * Use one pitch surface per screen (the hero or the key action area); content cards stay dark.
 */

/** A 24×24 stroke icon drawn big and faint off the surface's right edge. */
export function PitchMark({ children, size }: { children: ReactNode; size?: number }) {
  return (
    <span aria-hidden className="pitch-surface__mark" style={size ? ({ "--pitch-mark-size": `${size}px` } as CSSProperties) : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

interface PitchHeroProps {
  /** Small line above the headline ("Club Funds", "Rankings", …). */
  eyebrow?: ReactNode;
  /** Dark pill next to the eyebrow ("Best 27-0", a balance, a count). */
  badge?: ReactNode;
  title: ReactNode;
  /** h1 by default: the hero is the page's heading. */
  titleAs?: "h1" | "h2" | "p";
  titleId?: string;
  /** One short line under the headline. */
  description?: ReactNode;
  /** Watermark glyph (paths for a 24×24 stroke icon). */
  icon?: ReactNode;
  /** Actions on the surface: `.pitch-cta`, `.pitch-seg`, GameButtons (they turn black here). */
  children?: ReactNode;
  /** `page` is the compact header band, `feature` the bigger Classic-card size, `slim` a thin band (the draft screen). */
  size?: "page" | "feature" | "slim";
  className?: string;
  /** Extra content placed beside the title row (right-aligned), e.g. a small back link. */
  aside?: ReactNode;
  "aria-label"?: string;
}

export function PitchHero({
  eyebrow,
  badge,
  title,
  titleAs = "h1",
  titleId,
  description,
  icon,
  children,
  size = "page",
  className = "",
  aside,
  "aria-label": ariaLabel,
}: PitchHeroProps) {
  const Title = titleAs;
  return (
    <section className={`pitch-surface pitch-hero pitch-hero--${size} ${className}`.trim()} aria-label={ariaLabel}>
      {icon ? <PitchMark>{icon}</PitchMark> : null}
      <div className="relative min-w-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow || badge ? (
              <p className="pitch-eyebrow">
                {eyebrow}
                {badge ? <span className="pitch-pill">{badge}</span> : null}
              </p>
            ) : null}
            <Title id={titleId} className="pitch-title">
              {title}
            </Title>
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
        {description ? <p className="pitch-sub">{description}</p> : null}
        {children ? <div className="pitch-hero__actions">{children}</div> : null}
      </div>
    </section>
  );
}
