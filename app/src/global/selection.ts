import { DockviewApi } from "dockview-core";
import { createStore } from "solid-js/store";

import { getPanelId } from "../components/Dockview";
import { ProtoDataPayload } from "../proto/il2cpp";

const [selections, setSelections] = createStore<{
  [id: string]: ProtoDataPayload;
}>({});

const panels = new Set<string>();

export function setLastPanel(id: string) {
  panels.delete(id);
  panels.add(id);
  setSelections(id, (val) => val ?? {});
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

export function selectInLastPanel(api: DockviewApi, data: ProtoDataPayload) {
  const lastId = lastPanel();
  if (lastId) setSelections(lastId, data);
  else selectInNewPanel(api, data);
}

export function selectInNewPanel(api: DockviewApi, data: ProtoDataPayload) {
  const id = getPanelId();
  setSelections(id, data);
  api.addPanel({ id, component: "selection", title: "No Selection" });
}

export function setSelection(id: string, data: ProtoDataPayload) {
  setSelections(id, data);
}

export function getSelection(id: string) {
  return selections[id] ?? {};
}
