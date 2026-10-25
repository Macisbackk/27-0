import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

const GUIDE_ITEMS = [
  {
    title: "Manager Mode",
    body: "Pick a real Super League or Championship club, play each round in a tap, chase the Grand Final and unlock legends.",
  },
  {
    title: "Classic",
    body: "Spin and sign a 13 from Current or Era squads, chase 27-0, then fight for the play-offs.",
  },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        {
          title: "Daily Challenge",
          body: "A new rule every day: one club, one era, underdogs, no respins and more. One counted attempt per UK day.",
        },
        {
          title: "Weekly Challenge",
          body: "One rule and the same spins for everyone, all week (Monday to Sunday UK). One ranked attempt a week; later runs are practice. Score 10 a win, 15 a play-off win, +100 for the Grand Final and +50 for League Leaders. The top 10 when the week ends earn £150k.",
        },
      ]
    : []),
  {
    title: "Puzzles",
    body: "Super League Millionaire, Rugby League Wordle and the 3×3 Grid. Play daily for Club Funds.",
  },
  {
    title: "Club Funds",
    body: "Earn them from Classic seasons and play-offs, the Daily and Weekly Challenges, puzzles and achievements. Spend them in the Store on themes, your own kit, pitch styles, titles, leaderboard frames and Ball Knower mode.",
  },
];

export function HowToPlaySection() {
  return (
    <ul id="how-to-play" className="scroll-mt-16 divide-y divide-[var(--fl-line)]">
      {GUIDE_ITEMS.map((item) => (
        <li key={item.title} className="py-2.5 text-center">
          <p className="text-sm font-bold text-white">{item.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-[color:var(--fl-muted)]">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}
