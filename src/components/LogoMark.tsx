/** 27-0 wordmark — theme-aware; no black gradient on team themes. */
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
      className={`logo-mark whitespace-nowrap font-black tracking-tight ${sizeClass} ${className}`}
    >
      <span className="logo-mark-accent">27</span>
      <span className="logo-mark-rest">-0</span>
    </span>
  );
}
