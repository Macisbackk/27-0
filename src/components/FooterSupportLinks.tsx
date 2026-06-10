import { LINK } from "@/lib/ui/design-system";

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";
const X_URL = "https://x.com/27and0";

export function FooterSupportLinks() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy Me A Coffee — support 27-0"
        className={LINK.footer}
      >
        <CoffeeIcon />
        <span className="hidden sm:inline">Buy Me A Coffee</span>
      </a>
      <a href={SUGGESTIONS_MAIL} aria-label="Send a suggestion" className={LINK.footer}>
        <SuggestionsIcon />
        <span>Suggestions</span>
      </a>
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow 27-0 on X"
        className={LINK.footer}
      >
        <XIcon />
        <span>X</span>
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

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
