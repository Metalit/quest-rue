import { createRenderEffect } from "solid-js";
import { darkMode, monoFont, setDarkMode as setDarkModeInternal } from "./settings";

type Override = "light" | "dark";

const swap = (light: string, dark: string, override?: Override) =>
  (override ? override == "dark" : darkMode()) ? dark : light;

export const background = (o?: Override) => swap("#fafafa", "#0c0c0e", o);
export const base0 = (o?: Override) => swap("#e4e4e7", "#18181b", o);
export const base50 = (o?: Override) => swap("#d7d7db", "#242427", o);
export const base100 = (o?: Override) => swap("#c4c4ca", "#333338", o);
export const base200 = (o?: Override) => swap("#b4b4bc", "#3f3f47", o);
export const base300 = (o?: Override) => swap("#9f9fa9", "#52525c", o);
export const content = (o?: Override) => swap("#000000", "#ffffff", o);
export const secondary = (o?: Override) => swap("#52525c", "#9f9fa9", o);
export const shadow = (o?: Override) => swap("#0000001a", "#0000004d", o);

function setStyle(
  node: HTMLStyleElement,
  selector: string,
  keys: Record<string, string>,
) {
  const rules = Object.entries(keys)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n");
  const content = `${selector} { ${rules} }`;
  (node.firstChild as Text).data = content;
}

function makeStyle(selector: string = "", keys: Record<string, string> = {}) {
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(""));
  setStyle(style, selector, keys);
  return style;
}

const themeVars = makeStyle();

document.head.appendChild(themeVars);

createRenderEffect(() => {
  console.log("setting theme");
  setStyle(themeVars, "#root", {
    "--color-background": background(),
    "--color-base": base0(),
    "--color-base-50": base50(),
    "--color-base-100": base100(),
    "--color-base-200": base200(),
    "--color-base-300": base300(),
    "--color-base-content": content(),
    "--color-secondary-content": secondary(),
    "--color-shadow": shadow(),
    "--mono-font": monoFont(),
  });
});

// https://reemus.dev/article/disable-css-transition-color-scheme-change#heading-ultimate-solution-for-changing-color-scheme-without-transitions
const noTransitions = makeStyle("*", {
  "-webkit-transition": "none !important",
  "-moz-transition": "none !important",
  "-o-transition": "none !important",
  "-ms-transition": "none !important",
  transition: "none !important",
});

export function setDarkMode(value: boolean) {
  document.head.appendChild(noTransitions);
  setDarkModeInternal(value);
  // force the styles to be evaluated
  window.getComputedStyle(noTransitions).color;
  document.head.removeChild(noTransitions);
}
