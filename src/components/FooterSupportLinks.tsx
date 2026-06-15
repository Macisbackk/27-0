import { NAV } from "@/lib/ui/design-system";
import { CoffeeIcon, SuggestionsIcon, XIcon } from "./SupportLinkIcons";

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";
const X_URL = "https://x.com/27and0";

export function FooterSupportLinks() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <a
        href={SUGGESTIONS_MAIL}
        aria-label="Send a suggestion"
        title="Suggestions"
        className={NAV.supportLink}
      >
        <SuggestionsIcon />
      </a>
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy Me A Coffee — support 27-0"
        title="Buy Me A Coffee"
        className={NAV.supportLink}
      >
        <CoffeeIcon />
      </a>
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow 27-0 on X"
        title="Follow on X"
        className={NAV.supportLink}
      >
        <XIcon />
      </a>
    </div>
  );
}
