import { createStore, produce, reconcile } from "solid-js/store";

import { DockviewInterface, getPanelId } from "../dockview/Api";
import { ProtoDataPayload, ProtoDataSegment } from "../proto/il2cpp";
import { isProtoDataEqual } from "../types/matching";

type SelectionState = {
  stack: ProtoDataPayload[];
  back?: number;
};

const [selections, setSelections] = createStore<{
  [id: string]: SelectionState;
}>({});

function stackIndex(state: SelectionState) {
  const idx = state.stack.length - 1 - (state.back ?? 0);
  return idx < 0 ? undefined : idx;
}

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
  const lastId = lastPanel();
  const id = getPanelId();
  setSelections(id, { stack: [data] });
  api.addPanel("selection", {
    id,
    position: lastId
      ? { referencePanel: lastId, direction: "within" }
      : undefined,
  });
}

export function setSelection(id: string, data: ProtoDataPayload) {
  setSelections(
    id,
    produce((state) => {
      const i = stackIndex(state);
      if (i != undefined && isProtoDataEqual(state.stack[i].data, data.data))
        return;
      for (let i = 0; i < (state.back ?? 0); i++) state.stack.pop();
      state.back = undefined;
      state.stack.push(data);
    }),
  );
}

export function updateSelection(id: string, data: ProtoDataSegment) {
  const i = stackIndex(selections[id]);
  if (i == undefined) return;
  // important to do it this way so that the reactivity is finer grained
  setSelections(id, "stack", i, "data", reconcile(data));
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
  if (stackIndex(state) == undefined) return undefined;
  return state.stack[stackIndex(state)!];
}

export function clearSelections() {
  panels.clear();
  setSelections(reconcile({}));
}
