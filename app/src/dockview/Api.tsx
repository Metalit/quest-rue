/* @refresh reload */
import {
  AddPanelOptions,
  AddPanelPositionOptions,
  Direction,
  DockviewApi,
  DockviewGroupPanelApi,
  DockviewPanelApi,
  FloatingGroupOptions,
} from "dockview-core";
import { IDisposable } from "dockview-core/dist/cjs/lifecycle";
import {
  Component,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  ParentProps,
  useContext,
} from "solid-js";

import { uniqueNumber } from "../utils/misc";

export type StaticPanelOptions = { create: Component } & Omit<
  AddPanelOptions,
  "params" | "id" | "component" | "floating" | "position"
>;

export type PanelTemplate = StaticPanelOptions & { component: string };

export interface DockviewPanels {
  [component: string]: StaticPanelOptions;
}

export const getPanelId = (base: string = "panel") =>
  `${base}_${uniqueNumber()}`;

function dispose({ dispose }: IDisposable) {
  onCleanup(dispose);
}

type Size = { width: number; height: number };

type AddPanelFloatingGroupUnion = {
  floating: Partial<FloatingGroupOptions> | true;
  position: never;
};
type AddPanelPositionUnion = {
  floating: false;
  position: AddPanelPositionOptions;
};
type AddPanelPosition = AddPanelFloatingGroupUnion | AddPanelPositionUnion;
export type AddPanelCustom = Partial<
  AddPanelPosition & Size & { id: string; title: string }
>;

type AbsolutePosition = {
  direction: Omit<Direction, "within">;
};
type AddGroupOptionsWithPanel = {
  referencePanel: string;
  direction?: Omit<Direction, "within">;
};
type AddGroupOptionsWithGroup = {
  referenceGroup: string;
  direction?: Omit<Direction, "within">;
};
type AddGroupPosition =
  | AbsolutePosition
  | AddGroupOptionsWithPanel
  | AddGroupOptionsWithGroup;
export type AddGroupCustom = Partial<
  AddGroupPosition & Size & { id: string; floating: FloatingGroupOptions }
>;

function transformFloatingPosition(
  parent: HTMLDivElement,
  floating?: FloatingGroupOptions,
) {
  const rect = parent.getBoundingClientRect();
  if (floating?.x) floating.x -= rect.x;
  if (floating?.y) floating.y -= rect.y;
  return floating;
}

function transformOptions(parent: HTMLDivElement, options?: AddPanelCustom) {
  if (typeof options?.floating == "object")
    options.floating = transformFloatingPosition(parent, options.floating);
  return options;
}

export function makeDockviewInterface(
  parent: HTMLDivElement,
  api: DockviewApi,
  panels: () => DockviewPanels,
) {
  const addPanel = (component: string, options?: AddPanelCustom) =>
    api.addPanel({
      id: options?.id ?? getPanelId(),
      component,
      initialWidth: options?.width,
      initialHeight: options?.height,
      ...transformOptions(parent, options),
      ...panels()[component],
    });

  const addGroup = (panelIds: string[], options?: AddGroupCustom) => {
    const group = api.addGroup({
      id: options?.id ?? getPanelId("group"),
      direction: "above",
      initialWidth: options?.width,
      initialHeight: options?.height,
      ...options,
    });
    panelIds
      .map((id) => api.getPanel(id))
      .forEach((panel) => panel?.api.moveTo({ group }));
    if (options?.floating)
      api.addFloatingGroup(
        group,
        transformFloatingPosition(parent, options.floating),
      );
    return group;
  };

  const getPanel = (id: string) => api.getPanel(id);

  const templates = () =>
    Object.entries(panels()).map(
      (panel) => ({ component: panel[0], ...panel[1] }) satisfies PanelTemplate,
    );

  return { addPanel, addGroup, getPanel, templates, rawApi: api, parent };
}

export type DockviewInterface = ReturnType<typeof makeDockviewInterface>;

const DockviewContext = createContext<DockviewInterface>();
export function DockviewProvider(
  props: ParentProps<{ staticValue: Parameters<typeof makeDockviewInterface> }>,
) {
  return (
    <DockviewContext.Provider
      value={makeDockviewInterface(...props.staticValue)}
    >
      {props.children}
    </DockviewContext.Provider>
  );
}
export const useDockview = () => useContext(DockviewContext)!;

export function makeDockviewPanelInterface(api: DockviewPanelApi) {
  const [title, setTitle] = createSignal(api.title ?? api.id);
  dispose(api.onDidTitleChange((e) => setTitle(e.title)));
  createEffect(() => {
    api.setTitle(title());
    requestAnimationFrame(() => api.setTitle(title()));
  });

  const [active, setActive] = createSignal(api.isActive);
  dispose(api.onDidActiveChange((e) => setActive(e.isActive)));

  const close = () => api.close();

  return { title, setTitle, active, close, id: api.id, rawApi: api };
}

export type DockviewPanelInterface = ReturnType<
  typeof makeDockviewPanelInterface
>;

const DockviewPanelContext = createContext<DockviewPanelInterface>();
export function DockviewPanelProvider(
  props: ParentProps<{
    staticValue: Parameters<typeof makeDockviewPanelInterface>;
  }>,
) {
  return (
    <DockviewPanelContext.Provider
      value={makeDockviewPanelInterface(...props.staticValue)}
    >
      {props.children}
    </DockviewPanelContext.Provider>
  );
}
export const useDockviewPanel = () => useContext(DockviewPanelContext)!;

export function makeDockviewGroupInterface(api: DockviewGroupPanelApi) {
  const [location, setLocation] = createSignal(api.location.type);
  dispose(
    api.onDidLocationChange(({ location }) => setLocation(location.type)),
  );

  const [maximized, setMaximized] = createSignal(api.isMaximized());
  createEffect(() => (maximized() ? api.maximize() : api.exitMaximized()));

  const close = () => api.close();

  return { location, maximized, setMaximized, close, id: api.id, rawApi: api };
}

export type DockviewGroupInterface = ReturnType<
  typeof makeDockviewGroupInterface
>;

const DockviewGroupContext = createContext<DockviewGroupInterface>();
export function DockviewGroupProvider(
  props: ParentProps<{
    staticValue: Parameters<typeof makeDockviewGroupInterface>;
  }>,
) {
  return (
    <DockviewGroupContext.Provider
      value={makeDockviewGroupInterface(...props.staticValue)}
    >
      {props.children}
    </DockviewGroupContext.Provider>
  );
}
export const useDockviewGroup = () => useContext(DockviewGroupContext)!;
