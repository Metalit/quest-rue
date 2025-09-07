import { createElementSize } from "@solid-primitives/resize-observer";
import {
  AddGroupOptions,
  AddPanelOptions,
  CreateComponentOptions,
  createDockview,
  DockviewApi,
  DockviewOptions,
  FloatingGroupOptions,
  GroupPanelPartInitParameters,
  IContentRenderer,
  IGroupHeaderProps,
  IHeaderActionsRenderer,
  ITabRenderer,
  IWatermarkRenderer,
  TabPartInitParameters,
  WatermarkRendererInitParameters,
} from "dockview-core";
import {
  createContext,
  createEffect,
  createRenderEffect,
  JSX,
  onCleanup,
  onMount,
  Show,
  splitProps,
  useContext,
} from "solid-js";

import { UnionOmit } from "../global/utils";

const DockviewContext = createContext<DockviewApi>();

export const useDockview = () => useContext(DockviewContext)!;

class CustomRenderer<T, Params = Record<string, never>> {
  readonly _create: (params: T & Params) => JSX.Element;
  readonly _params: Params;
  _element: HTMLElement | undefined;

  constructor(create: (params: T & Params) => JSX.Element, params: Params) {
    this._create = create;
    this._params = params;
  }

  init(params: T): void {
    this._element = this._create({ ...params, ...this._params }) as HTMLElement;
  }

  get element(): HTMLElement {
    return this._element!;
  }

  dispose(): void {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreateFn<T extends CustomRenderer<never, any>> = T["_create"];

class CustomPanel
  extends CustomRenderer<GroupPanelPartInitParameters, { id: string }>
  implements IContentRenderer {}

class CustomTab
  extends CustomRenderer<TabPartInitParameters, { id: string }>
  implements ITabRenderer {}

class CustomWatermark
  extends CustomRenderer<WatermarkRendererInitParameters>
  implements IWatermarkRenderer {}

class CustomHeader
  extends CustomRenderer<IGroupHeaderProps>
  implements IHeaderActionsRenderer {}

export function DockviewPanel(props: AddPanelOptions) {
  const api = useDockview();
  if (!api) throw "DockviewPanel must be a child of a Dockview";
  onMount(() => {
    const panel = api.addPanel(props);
    onCleanup(() => api.removePanel(panel));
  });
  return <></>;
}

export function DockviewGroup(
  props: UnionOmit<AddGroupOptions, "panels" | "activePanel" | "direction"> & {
    direction?: AddGroupOptions["direction"];
    panels?: string[];
    floating?: FloatingGroupOptions;
    children: JSX.Element;
  },
) {
  const api = useDockview();
  if (!api) throw "DockviewGroup must be a child of a Dockview";
  const [custom, children, normal] = splitProps(
    props,
    ["panels", "floating"],
    ["children"],
  );
  onMount(() => {
    const group = api.addGroup({ direction: "above", ...normal });
    custom.panels
      ?.map((id) => api.getPanel(id))
      .forEach((panel) => panel?.api.moveTo({ group }));
    if (custom.floating) api.addFloatingGroup(group, custom.floating);
    onCleanup(() => api.removeGroup(group));
  });
  return <>{children.children}</>;
}

interface DockviewProps extends JSX.HTMLAttributes<HTMLDivElement> {
  panels: { [name: string]: CreateFn<CustomPanel> };
  leftHeader?: CreateFn<CustomHeader>;
  rightHeader?: CreateFn<CustomHeader>;
  prefixHeader?: CreateFn<CustomHeader>;
  tabs?: { [name: string]: CreateFn<CustomTab> };
  watermark?: CreateFn<CustomWatermark>;
  options?: Omit<DockviewOptions, "disableAutoResizing">;
  onReady?: (value: DockviewApi) => void;
}

export function Dockview(props: DockviewProps) {
  const [children, custom, normal] = splitProps(props, ["children"], ["class"]);
  const main = (
    <div {...normal} class={`w-full h-full ${custom.class ?? ""}`} />
  );

  const createComponent = (options: CreateComponentOptions) =>
    new CustomPanel(props.panels[options.name], { id: options.id });
  const createRightHeaderActionComponent = () =>
    new CustomHeader(props.rightHeader!, {});
  const createLeftHeaderActionComponent = () =>
    new CustomHeader(props.leftHeader!, {});
  const createPrefixHeaderActionComponent = () =>
    new CustomHeader(props.prefixHeader!, {});
  const createTabComponent = (options: CreateComponentOptions) =>
    new CustomTab(props.tabs![options.name], { id: options.id });
  const createWatermarkComponent = () =>
    new CustomWatermark(props.watermark!, {});

  const api = createDockview(main as HTMLDivElement, {
    createComponent,
    disableAutoResizing: true,
    theme: { name: "custom", className: "dockview-custom", gap: 12 },
  });
  createRenderEffect(() =>
    api.updateOptions({
      ...(props.leftHeader ? { createLeftHeaderActionComponent } : {}),
      ...(props.rightHeader ? { createRightHeaderActionComponent } : {}),
      ...(props.prefixHeader ? { createPrefixHeaderActionComponent } : {}),
      ...(props.tabs ? { createTabComponent } : {}),
      ...(props.watermark ? { createWatermarkComponent } : {}),
      ...(props.options ?? {}),
    }),
  );
  createEffect(() => props.onReady?.(api));
  onCleanup(() => api.dispose());

  const size = createElementSize(main as HTMLDivElement);
  createEffect(() => api.layout(size.width, size.height));

  return (
    <DockviewContext.Provider value={api}>
      {main}
      {/* wait until we have a size to add panels and groups so that floating ones get positioned correctly */}
      <Show when={size.width > 0 || size.height > 0}>{children.children}</Show>
    </DockviewContext.Provider>
  );
}
