import * as monaco from "monaco-editor";
import { createEffect, onCleanup } from "solid-js";

import { darkMode, monoFont } from "../global/settings";
import { ProtoDataSegment, ProtoTypeInfo } from "../proto/il2cpp";
import { protoDataToString } from "../types/format";
import { isProtoDataEqual } from "../types/matching";
import { stringToDataSegment, validString } from "../types/serialization";
import { createUpdatingParser, dispose } from "../utils/solid";

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
  smoothScrolling: true,
  contextmenu: false,
  codeLens: false,
  renderWhitespace: "trailing",
};

export interface DataEditorProps {
  class?: string;
  typeInfo: ProtoTypeInfo;
  value?: ProtoDataSegment;
  onChange?: (value: ProtoDataSegment) => void;
  readonly?: boolean;
}

export function DataEditor(props: DataEditorProps) {
  const [input, setInput] = createUpdatingParser(
    () => props.value,
    (data) => props.onChange?.(data),
    isProtoDataEqual,
    (value) => protoDataToString(value, props.typeInfo),
    (input) => stringToDataSegment(input, props.typeInfo)!,
    (input) => validString(input, props.typeInfo),
  );

  const div = <div class={`overflow-clip ${props.class}`} />;

  const editor = monaco.editor.create(div as HTMLDivElement, {
    ...sharedOptions,
    language: "json",
    folding: false,
    lineNumbers: "off",
    lineDecorationsWidth: 0,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    hover: { enabled: false },
    links: false,
  });

  // disable command palette keybind
  editor.addCommand(monaco.KeyCode.F1, () => {});

  createEffect(() =>
    editor.updateOptions({
      readOnly: props.readonly,
      fontFamily: monoFont(),
      theme: darkMode() ? "custom-dark" : "custom-light",
    }),
  );
  onCleanup(() => editor.dispose());

  // setting the value resets the cursor, so only do it if it's from external
  let lastInput = input();
  createEffect(() => {
    if (input() != lastInput) {
      lastInput = input();
      editor.setValue(lastInput);
    }
  });
  dispose(
    editor.onDidChangeModelContent(() => {
      lastInput = editor.getValue();
      setInput(lastInput);
    }),
  );

  return div;
}
