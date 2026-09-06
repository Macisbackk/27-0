"use client";

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

export function MobileScreen({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`m-screen ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function MobileSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`m-section ${className}`.trim()}>
      {label ? <h2 className="m-section__label">{label}</h2> : null}
      {children}
    </section>
  );
}

export function MobileList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ul className={`m-list ${className}`.trim()}>{children}</ul>;
}

export function MobileListRow({
  index,
  primary,
  secondary,
  value,
  chevron = false,
  selected = false,
  onClick,
  disabled,
  tutorialTarget,
  children,
}: {
  index?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  tutorialTarget?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      {index != null ? <span className="m-row__index">{index}</span> : null}
      <span className="m-row__body">
        <span className="m-row__primary">{primary}</span>
        {secondary ? <span className="m-row__secondary">{secondary}</span> : null}
      </span>
      {value != null ? <span className="m-row__value">{value}</span> : null}
      {children}
      {chevron ? (
        <span className="m-row__chevron" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          disabled={disabled}
          data-tutorial-target={tutorialTarget}
          onClick={onClick}
          className={`m-row ${selected ? "m-row--selected" : ""}`.trim()}
        >
          {body}
        </button>
      </li>
    );
  }

  return (
    <li
      className={`m-row ${selected ? "m-row--selected" : ""}`.trim()}
      data-tutorial-target={tutorialTarget}
    >
      {body}
    </li>
  );
}

export function MobilePrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`m-primary-btn btn-press ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function MobileSecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`m-secondary-btn btn-press ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function MobileMetric({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="m-metric">
      <span className="m-metric__label">{label}</span>
      <span className="m-metric__value">{value}</span>
    </div>
  );
}

export function MobileEmptyState({ children }: { children: ReactNode }) {
  return <p className="m-empty">{children}</p>;
}
