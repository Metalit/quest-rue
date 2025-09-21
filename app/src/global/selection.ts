import { createStore, produce, reconcile } from "solid-js/store";

import { DockviewInterface, getPanelId } from "../dockview/Api";
import { ProtoDataPayload } from "../proto/il2cpp";

const [selections, setSelections] = createStore<{
  [id: string]: { stack: ProtoDataPayload[]; back?: number };
}>({});

const panels = new Set<string>();

export function setLastPanel(id: string) {
  panels.delete(id);
  panels.add(id);
  setSelections(id, (val) => val ?? { stack: [] });
}

export function removePanel(id: string) {
  panels.delete(id);
  setSelections({ [id]: undefined });
}

function lastPanel() {
  let value;
  for (value of panels);
  return value;
}

export function selectInLastPanel(
  api: DockviewInterface,
  data: ProtoDataPayload,
) {
  const lastId = lastPanel();
  if (lastId) setSelection(lastId, data);
  else selectInNewPanel(api, data);
}

export function selectInNewPanel(
  api: DockviewInterface,
  data: ProtoDataPayload,
) {
  const id = getPanelId();
  setSelections(id, { stack: [data] });
  api.addPanel("selection", { id });
}

export function setSelection(id: string, data: ProtoDataPayload) {
  setSelections(
    id,
    produce((state) => {
      for (let i = 0; i < (state.back ?? 0); i++) state.stack.pop();
      state.back = undefined;
      state.stack.push(data);
    }),
  );
}

export function backSelection(id: string) {
  if (!(id in selections)) return;
  setSelections(
    id,
    "back",
    (val) =>
      Math.min(1 + (val ?? 0), selections[id].stack.length - 1) || undefined,
  );
}

export function forwardSelection(id: string) {
  if (!(id in selections)) return;
  setSelections(id, "back", (val) => val && (val > 1 ? val - 1 : undefined));
}

export function hasBackSelection(id: string) {
  return (
    !!selections[id] &&
    (selections[id].back ?? 0) < selections[id].stack.length - 1
  );
}

export function hasForwardSelection(id: string) {
  return !!selections[id]?.back && selections[id].back > 0;
}

export function getSelection(id: string) {
  const state = selections[id] ?? [];
  if (state.stack.length == 0) return undefined;
  return state.stack[state.stack.length - 1 - (state.back ?? 0)];
}

export function clearSelections() {
  panels.clear();
  setSelections(reconcile({}));
}
