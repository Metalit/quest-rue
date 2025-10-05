import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { base100, base200, base50, content, secondary, shadow } from "./theme";

// @ts-expect-error this is just how they say to do it, idk it's weird
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

const makeColors = (theme: "light" | "dark") => ({
  "focusBorder": content(theme),
  "contrastBorder": shadow(theme),
  "editor.foreground": content(theme),
  "editor.background": base50(theme),
  "editor.selectionBackground": base200(theme),
  "editor.lineHighlightBackground": base100(theme),
  "editorCursor.foreground": content(theme),
  "editorWhitespace.foreground": secondary(theme),
  "input.foreground": content(theme),
  "input.background": base100(theme),
  "widget.foreground": content(theme),
  "widget.background": base50(theme),
  "widget.border": shadow(theme),
  "widget.shadow": shadow(theme),
  "editorWidget.foreground": content(theme),
  "editorWidget.background": base50(theme),
  "inputOption.hoverBackground": shadow(theme),
  "inputOption.activeBackground": shadow(theme),
  "inputOption.activeBorder": "#00000000",
  "toolbar.hoverBackground": shadow(theme),
});

monaco.editor.defineTheme("custom-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: makeColors("light"),
});

monaco.editor.defineTheme("custom-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: makeColors("dark"),
});
