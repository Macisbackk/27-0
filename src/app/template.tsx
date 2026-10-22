/**
 * Re-mounts on every navigation, so each page fades in instead of snapping.
 * Opacity only (see src/styles/motion.css) and keeps <main>'s flex column layout.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fl-page flex min-w-0 max-w-full flex-1 flex-col">{children}</div>;
}
