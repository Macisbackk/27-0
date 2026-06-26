import { STORAGE_KEYS } from "../storage/keys";

/** Inline script — applies cached Store theme CSS vars before React hydrates. */
export const UI_THEME_BOOTSTRAP_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.uiThemeCssCache)});if(!raw)return;var data=JSON.parse(raw);var root=document.documentElement;if(data.themeId)root.dataset.uiTheme=data.themeId;if(data.logoGlow)root.dataset.themeLogoGlow="true";else root.dataset.themeLogoGlow="false";if(data.vars&&typeof data.vars==="object"){Object.keys(data.vars).forEach(function(k){root.style.setProperty(k,data.vars[k]);});}}catch(e){}})();`;
