/** 27-0 wordmark — scoreboard mark; Store theme accents; no black gradient. */
export function LogoMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "text-5xl sm:text-7xl"
      : "text-xl sm:text-3xl";

  return (
    <span
      className={`logo-mark inline-flex flex-col items-center whitespace-nowrap font-black tracking-tight ${sizeClass} ${className}`}
    >
      <span className="inline-flex items-baseline leading-none">
        <span className="logo-mark-27">27</span>
        <span className="logo-mark-dash">-</span>
        <span className="logo-mark-0">0</span>
      </span>
    </span>
  );
}
