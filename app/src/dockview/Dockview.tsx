import { createElementSize } from "@solid-primitives/resize-observer";
import {
  CreateComponentOptions,
  createDockview,
  DockviewApi,
  DockviewOptions,
} from "dockview-core";
import {
  Component,
  createEffect,
  createRenderEffect,
  getOwner,
  JSX,
  onCleanup,
  splitProps,
} from "solid-js";

import {
  DockviewContext,
  DockviewInterface,
  DockviewPanels,
  makeDockviewInterface,
} from "./api";
import {
  CustomHeader,
  CustomPanel,
  CustomTab,
  CustomWatermark,
} from "./Renderer";

interface DockviewProps {
  leftHeader?: Component;
  rightHeader?: Component;
  prefixHeader?: Component;
  tabs?: { [name: string]: Component };
  watermark?: Component;
  options?: Omit<DockviewOptions, "disableAutoResizing">;
  onReady?: (api: DockviewInterface) => void;
}

function DockviewInitializer(
  props: DockviewProps & { api: DockviewApi; panels: DockviewPanels },
) {
  const owner = getOwner()!;

  const createComponent = (options: CreateComponentOptions) =>
    new CustomPanel(props.panels[options.name].create, owner);
  const createRightHeaderActionComponent = () =>
    new CustomHeader(props.rightHeader!, owner);
  const createLeftHeaderActionComponent = () =>
    new CustomHeader(props.leftHeader!, owner);
  const createPrefixHeaderActionComponent = () =>
    new CustomHeader(props.prefixHeader!, owner);
  const createTabComponent = (options: CreateComponentOptions) =>
    new CustomTab(props.tabs![options.name], owner);
  const createWatermarkComponent = () =>
    new CustomWatermark(props.watermark!, owner);

  // call immediately
  createRenderEffect(() =>
    props.api.updateOptions({
      createComponent,
      ...(props.leftHeader ? { createLeftHeaderActionComponent } : {}),
      ...(props.rightHeader ? { createRightHeaderActionComponent } : {}),
      ...(props.prefixHeader ? { createPrefixHeaderActionComponent } : {}),
      ...(props.tabs ? { createTabComponent } : {}),
      ...(props.watermark ? { createWatermarkComponent } : {}),
      ...(props.options ?? {}),
      defaultTabComponent: Object.keys(props.tabs ?? {}).find(() => true),
    }),
  );

  return <></>;
}

export function Dockview(
  props: DockviewProps &
    Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
      children: DockviewPanels;
    },
) {
  const [children, custom, normal] = splitProps(
    props,
    ["children"],
    [
      "class",
      "leftHeader",
      "rightHeader",
      "prefixHeader",
      "tabs",
      "watermark",
      "options",
      "onReady",
    ],
  );
  const panels = () => children.children;

  const main = <div {...normal} class={`size-full ${custom.class ?? ""}`} />;

  const api = createDockview(main as HTMLDivElement, {
    createComponent: undefined!,
    disableAutoResizing: true,
    theme: { name: "custom", className: "dockview-custom", gap: 12 },
  });
  onCleanup(() => api.dispose());

  // eslint-disable-next-line solid/reactivity
  const iface = makeDockviewInterface(api, panels);

  const size = createElementSize(main as HTMLDivElement);
  createEffect(() => {
    api.layout(size.width, size.height);
    if (size.width > 0 || size.height > 0) custom.onReady?.(iface);
  });

  return (
    <DockviewContext.Provider value={iface}>
      {main}
      {/* we want the provider to be available in our getOwner call */}
      <DockviewInitializer {...custom} api={api} panels={panels()} />
    </DockviewContext.Provider>
  );
}
