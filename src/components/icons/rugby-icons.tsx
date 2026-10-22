/**
 * 27-0's own icon set: rugby league things instead of the house / play button / bar chart / person
 * every other site uses. Each export is the inside of a 24×24 stroke icon (stroke="currentColor",
 * strokeWidth 2, round caps and joins); wrap it in whatever <svg> the spot needs.
 */

/** Home: the H of the goalposts. */
export const PostsGlyph = () => (
  <>
    <path d="M6 3v18M18 3v18M6 13h12" />
    <path d="M4 21h4M16 21h4" />
  </>
);

/** Classic: a rugby ball with its laces. */
export const BallGlyph = () => (
  <>
    <ellipse cx="12" cy="12" rx="9.5" ry="5.6" transform="rotate(-40 12 12)" />
    <path d="M8.6 15.4l6.8-6.8M10.4 11.8l1.8 1.8M12.2 10l1.8 1.8" />
  </>
);

/** Tables: the league ladder. */
export const LadderGlyph = () => <path d="M4 5h2M9 5h11M4 12h2M9 12h11M4 19h2M9 19h7" />;

/** Profile: the coach's whistle. */
export const WhistleGlyph = () => (
  <>
    <circle cx="9" cy="14" r="5.5" />
    <path d="M12.5 9.8 21 6v4.5l-5.6 2.3" />
    <path d="M4 6.5 2.5 5" />
    <circle cx="9" cy="14" r="1.3" />
  </>
);

/** Manager Mode: the tactics board. */
export const BoardGlyph = () => (
  <>
    <rect x="4.5" y="4" width="15" height="17" rx="1.5" />
    <path d="M9 4V2.8h6V4" />
    <path d="M8 9l2.4 2.4M10.4 9 8 11.4" />
    <circle cx="15.5" cy="16" r="1.4" />
    <path d="M10 15c1.5-2.5 3-3 4.5-5.5" />
  </>
);

/** Era Classic: an old match programme. */
export const ProgrammeGlyph = () => (
  <>
    <path d="M6 3h11l2 2v16H6z" />
    <path d="M9 8h7M9 12h7M9 16h4" />
  </>
);

/** Puzzles: a row of letter tiles. */
export const TilesGlyph = () => (
  <>
    <rect x="3" y="7" width="5" height="10" rx="1" />
    <rect x="9.5" y="7" width="5" height="10" rx="1" />
    <rect x="16" y="7" width="5" height="10" rx="1" />
  </>
);

/** Daily Challenge: today's fixture. */
export const FixtureGlyph = () => (
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="1.6" />
  </>
);

/** Store: a shirt on a hanger in the club shop. */
export const ShopGlyph = () => (
  <>
    <path d="M12 5.5V4.6a1.6 1.6 0 1 1 1.6-1.6" />
    <path d="M8.5 8 4 10l1.5 4 2-.8V21h9v-7.8l2 .8L20 10l-4.5-2c-.6 1.2-2 2-3.5 2s-2.9-.8-3.5-2z" />
  </>
);
