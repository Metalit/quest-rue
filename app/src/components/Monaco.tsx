import * as monaco from "monaco-editor";
import { createEffect, onCleanup } from "solid-js";
import { darkMode, monoFont } from "../global/settings";

const sharedOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  autoDetectHighContrast: false,
  fontLigatures: true,
  renderLineHighlightOnlyWhenFocus: true,
  wordWrap: "on",
  bracketPairColorization: { enabled: true },
  overviewRulerBorder: false,
  scrollbar: {
    verticalHasArrows: true,
    arrowSize: 16,
    vertical: "visible",
    horizontal: "hidden",
    verticalScrollbarSize: 16,
    verticalSliderSize: 10,
    useShadows: false,
  },
  contextmenu: false,
  codeLens: false,
  formatOnType: true,
  renderWhitespace: "trailing",
};

const startingValue = `{
  "key": "value"
}`;

export function SimpleMonacoEditor(props: { class: string }) {
  const div = <div class={`overflow-clip ${props.class}`} />;

  const editor = monaco.editor.create(div as HTMLDivElement, {
    ...sharedOptions,
    value: startingValue,
    language: "json",
    folding: false,
    lineNumbers: "off",
    lineDecorationsWidth: 0,
    minimap: { enabled: false },
    hover: { enabled: false },
    links: false,
  });

  // disable command palette keybind
  editor.addCommand(monaco.KeyCode.F1, () => {});

  createEffect(() =>
    editor.updateOptions({
      fontFamily: monoFont(),
      theme: darkMode() ? "custom-dark" : "custom-light",
    }),
  );
  onCleanup(() => editor.dispose());

  return div;
}
