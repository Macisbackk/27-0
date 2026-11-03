/**
 * "Loading…" while /play waits for the board. While it shows, the site footer is hidden
 * (globals.css, .play-loading): otherwise the footer sits just under this line and the board
 * then pushes it down the screen, which was most of /play's layout shift on phones.
 */
export function PlayLoading() {
  return <p className="play-loading p-6 text-center text-pitch-400">Loading…</p>;
}
