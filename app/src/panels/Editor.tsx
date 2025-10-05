import { SimpleMonacoEditor } from "../components/Monaco";

export function Editor() {
  return (
    <div class="p-2 size-full flex flex-col">
      <SimpleMonacoEditor class="grow min-h-0 -m-1 p-1 rounded bg-base-50" />
    </div>
  );
}
