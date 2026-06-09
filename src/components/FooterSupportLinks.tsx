const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";

const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-pitch-600/60 bg-pitch-900/50 px-3 py-1.5 text-[11px] font-medium text-gray-400 transition hover:border-accent-green/40 hover:text-white";

export function FooterSupportLinks() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Support 27-0"
        className={LINK_CLASS}
      >
        <CoffeeIcon />
        <span className="hidden sm:inline">Support</span>
      </a>
      <a href={SUGGESTIONS_MAIL} aria-label="Send a suggestion" className={LINK_CLASS}>
        <SuggestionsIcon />
        <span>Suggestions</span>
      </a>
    </div>
  );
}

function CoffeeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function SuggestionsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
