/**
 * 27-0 wordmark: two lit scoreboard panels (27 and 0) with a dash between,
 * the way the score hangs over the terrace on a Friday night. Digits take the Store theme colour.
 */
export function LogoMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "text-5xl sm:text-7xl" : "text-[22px] sm:text-3xl";

  return (
    <span className={`logo-mark inline-flex items-center whitespace-nowrap ${sizeClass} ${className}`}>
      <span className="logo-mark__cell">27</span>
      <span className="logo-mark__dash" aria-hidden />
      <span className="logo-mark__cell">0</span>
    </span>
  );
}
