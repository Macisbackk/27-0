import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

const GUIDE_ITEMS: { title: string; lines: string[] }[] = [
  {
    title: "Classic",
    lines: [
      "Spin for a club, sign a player, fill your 13.",
      "Classic uses 2026 squads. Era Classic uses any era.",
      "Go 27-0, then win the play-offs.",
    ],
  },
  {
    title: "Manager Mode",
    lines: ["Run a real Super League or Championship club.", "Win trophies. Unlock legends."],
  },
  {
    title: "How games are won",
    lines: [
      "The stronger your 13, the better your odds.",
      "No win is certain. No loss is either.",
    ],
  },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        {
          title: "Daily",
          lines: [
            "A new rule every day. 1 counted run.",
            "Finish it, win or lose, to keep your streak.",
            "10 a win, 15 a play-off win.",
            "+50 for League Leaders, +100 for the Grand Final.",
            "Every 7-day streak earns a freeze (hold 2).",
          ],
        },
        {
          title: "Weekly",
          lines: [
            "Same rule and spins for all, Monday to Sunday.",
            "1 ranked run a week. Same scoring as the Daily.",
            "Top 10 earn £150k.",
          ],
        },
      ]
    : []),
  {
    title: "Puzzles",
    lines: [
      "Golden Point Quiz, Wordle and the Grid.",
      "Play daily for Club Funds.",
      "Your first quiz run pays in full. Later runs pay 10%.",
    ],
  },
  {
    title: "Club Funds",
    lines: ["Earn them by winning and playing daily.", "Spend them in the Store."],
  },
];

export function HowToPlaySection() {
  return (
    <ul id="how-to-play" className="scroll-mt-16 divide-y divide-[var(--fl-line)]">
      {GUIDE_ITEMS.map((item) => (
        <li key={item.title} className="py-2.5 text-center">
          <p className="text-sm font-bold text-white">{item.title}</p>
          {item.lines.map((line) => (
            <p key={line} className="mt-0.5 text-[13px] leading-snug text-[color:var(--fl-muted)]">
              {line}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}
