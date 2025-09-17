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
  Component,
  createContext,
  createEffect,
  createRenderEffect,
  createRoot,
  getOwner,
  JSX,
  onCleanup,
  onMount,
  Owner,
  Show,
  splitProps,
  useContext,
} from "solid-js";

import { UnionOmit, uniqueNumber } from "../global/utils";

const DockviewContext = createContext<DockviewApi>();

export const useDockview = () => useContext(DockviewContext)!;

export const getPanelId = () => `panel_${uniqueNumber()}`;

class CustomRenderer<
  T,
  Params extends Record<string, unknown> = Record<string, never>,
> {
  _element: HTMLElement | undefined;
  _dispose: (() => void) | undefined;

  private create(params: T, disposer: () => void) {
    this._dispose = disposer;
    // for compiler reasons this needs to be created in JSX for hmr to work
    this._element = (
      <div class="overflow-auto size-full">
        {this._create({ ...params, ...this._params })}
      </div>
    ) as HTMLElement;
  }

  constructor(
    readonly _create: Component<T & Params>,
    readonly _params: Params,
    readonly _owner: Owner,
  ) {}

  init(params: T): void {
    createRoot(this.create.bind(this, params), this._owner);
  }

  get element(): HTMLElement {
    return this._element!;
  }

  dispose() {
    console.log("disponse", this._params);
    this._dispose?.();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CreateFn<T extends CustomRenderer<never, any>> = T["_create"];

class CustomPanel
  extends CustomRenderer<GroupPanelPartInitParameters, { id: string }>
  implements IContentRenderer {}

export type PanelProps = Parameters<CreateFn<CustomPanel>>[0];

class CustomTab
  extends CustomRenderer<TabPartInitParameters, { id: string }>
  implements ITabRenderer {}

class CustomWatermark
  extends CustomRenderer<WatermarkRendererInitParameters>
  implements IWatermarkRenderer {}

class CustomHeader
  extends CustomRenderer<IGroupHeaderProps>
  implements IHeaderActionsRenderer {}

export function DockviewPanel(
  props: Partial<AddPanelOptions> & { component: string },
) {
  const api = useDockview();
  if (!api) throw "DockviewPanel must be a child of a Dockview";
  onMount(() => {
    const id = props.id ?? getPanelId();
    const panel = api.addPanel({ ...props, id });
    onCleanup(() => api.removePanel(panel));
  });
  return <></>;
}

export function DockviewGroup(
  props: Partial<UnionOmit<AddGroupOptions, "panels" | "activePanel">> & {
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

interface DockviewProps {
  panels: { [name: string]: CreateFn<CustomPanel> };
  leftHeader?: CreateFn<CustomHeader>;
  rightHeader?: CreateFn<CustomHeader>;
  prefixHeader?: CreateFn<CustomHeader>;
  tabs?: { [name: string]: CreateFn<CustomTab> };
  watermark?: CreateFn<CustomWatermark>;
  options?: Omit<DockviewOptions, "disableAutoResizing">;
  onReady?: (value: DockviewApi) => void;
}

function DockviewInitializer(props: DockviewProps & { api: DockviewApi }) {
  const owner = getOwner()!;

  const createComponent = (options: CreateComponentOptions) =>
    new CustomPanel(props.panels[options.name], { id: options.id }, owner);
  const createRightHeaderActionComponent = () =>
    new CustomHeader(props.rightHeader!, {}, owner);
  const createLeftHeaderActionComponent = () =>
    new CustomHeader(props.leftHeader!, {}, owner);
  const createPrefixHeaderActionComponent = () =>
    new CustomHeader(props.prefixHeader!, {}, owner);
  const createTabComponent = (options: CreateComponentOptions) =>
    new CustomTab(props.tabs![options.name], { id: options.id }, owner);
  const createWatermarkComponent = () =>
    new CustomWatermark(props.watermark!, {}, owner);

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
  createEffect(() => props.onReady?.(props.api));

  return <></>;
}

export function Dockview(
  props: DockviewProps & JSX.HTMLAttributes<HTMLDivElement>,
) {
  const [children, custom, normal] = splitProps(
    props,
    ["children"],
    [
      "class",
      "panels",
      "leftHeader",
      "rightHeader",
      "prefixHeader",
      "tabs",
      "watermark",
      "options",
      "onReady",
    ],
  );
  const main = (
    <div {...normal} class={`size-full ${custom.class ?? ""}`} />
  );

  const api = createDockview(main as HTMLDivElement, {
    createComponent: undefined!,
    disableAutoResizing: true,
    theme: { name: "custom", className: "dockview-custom", gap: 12 },
  });
  // call after children dispose their own panels and groups
  onCleanup(() => api.dispose());

  const size = createElementSize(main as HTMLDivElement);
  createEffect(() => api.layout(size.width, size.height));

  return (
    <DockviewContext.Provider value={api}>
      {main}
      {/* we want the provider to be available in our getOwner call for convenience */}
      <DockviewInitializer {...custom} api={api} />
      {/* wait until we have a size to add panels and groups so that floating ones get positioned correctly */}
      <Show when={size.width > 0 || size.height > 0}>{children.children}</Show>
    </DockviewContext.Provider>
  );
}
