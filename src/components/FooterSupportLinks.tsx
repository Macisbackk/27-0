import { contactMailto } from "@/lib/contact";
import { NAV } from "@/lib/ui/design-system";
import { CoffeeIcon, SuggestionsIcon, XIcon } from "./SupportLinkIcons";
import { SHOW_TIP_LINKS } from "@/lib/native/platform";

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL = contactMailto("27-0 Suggestion");
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
      {SHOW_TIP_LINKS ? (
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy Me a Coffee — support 27-0"
        title="Buy Me a Coffee"
        className={NAV.supportLink}
      >
        <CoffeeIcon />
      </a>
      ) : null}
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
