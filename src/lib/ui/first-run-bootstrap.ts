/**
 * Home hub layout-shift guard. Whether the Classic card shows the two-line first-run title
 * ("Sign a 13. / Win all 27.") is only known after mount (HomeModeSelector reads this device's
 * stats), so a new player's card grew by a line after first paint. This sets
 * `data-first-run="1"` on <html> before paint when the device has no finished runs and no
 * Manager save, and the card reserves the second line until the hub is read (pitch.css,
 * .home-classic-title). A wrong guess only costs the old shift; nothing renders differently.
 */
import { STORAGE_KEYS } from "../storage/keys";

const CAREER_SAVE_KEY = "27-0-career-v2-save";

export const FIRST_RUN_BOOTSTRAP_SCRIPT = `(function(){try{var r=document.documentElement;if(localStorage.getItem(${JSON.stringify(
  CAREER_SAVE_KEY,
)})){r.removeAttribute("data-first-run");return;}var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.stats,
)})||"null")||{};var n=function(b){return b&&typeof b==="object"?(Number(b.totalRuns)||0)+(Number(b.totalSeasonsSimulated)||0):0;};if(n(s.normal)+n(s.eraNormal)===0)r.setAttribute("data-first-run","1");else r.removeAttribute("data-first-run");}catch(e){}})();`;
