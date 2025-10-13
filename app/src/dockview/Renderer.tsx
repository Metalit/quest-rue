import {
  DockviewPanelApi,
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
  createEffect,
  createRoot,
  createSignal,
  JSX,
  onCleanup,
  Owner,
} from "solid-js";

import {
  DockviewGroupProvider,
  DockviewPanelProvider,
  StaticPanelOptions,
} from "./Api";

abstract class CustomRenderer<T> {
  _element: HTMLElement | undefined;
  _dispose: (() => void) | undefined;

  protected create(params: T, disposer: () => void) {
    this._dispose = disposer;
    this._element = (
      <div class="size-full">{this.provide(params)}</div>
    ) as HTMLElement;
  }

  constructor(
    readonly _create: Component,
    readonly _owner: Owner,
  ) {}

  init(params: T): void {
    createRoot(this.create.bind(this, params), this._owner);
  }

  get element(): HTMLElement {
    return this._element!;
  }

  dispose() {
    this._dispose?.();
  }

  // for compiler reasons this needs to be created in JSX for hmr to work
  protected _provide: (_params: T) => JSX.Element = () => <this._create />;
  protected provide: typeof this._provide = this._provide;
}

export class CustomPanel
  extends CustomRenderer<GroupPanelPartInitParameters>
  implements IContentRenderer
{
  constructor(
    readonly _options: StaticPanelOptions,
    readonly _owner: Owner,
  ) {
    super(_options.create, _owner);
  }

  private formatPx(px?: number) {
    if (px == undefined) return "";
    return px + "px";
  }

  private setupFloatingConstriants(api: DockviewPanelApi) {
    const style = {
      minWidth: this.formatPx(this._options.minimumWidth),
      minHeight: this.formatPx(this._options.minimumHeight),
      maxWidth: this.formatPx(this._options.maximumWidth),
      maxHeight: this.formatPx(this._options.maximumHeight),
    } as const;

    const [active, setActive] = createSignal(true);
    const { dispose } = api.onDidActiveChange((e) => setActive(e.isActive));
    onCleanup(dispose);

    createEffect(() => {
      if (!active()) return;
      let resizer = this._element;
      requestAnimationFrame(() => {
        while (resizer && !resizer.classList.contains("dv-resize-container"))
          resizer = resizer.parentElement ?? undefined;
        if (!resizer) return;

        const update = (prop: keyof typeof style) =>
          (resizer!.style[prop] = style[prop]);
        update("minWidth");
        update("minHeight");
        update("maxWidth");
        update("maxHeight");
      });
    });
  }

  protected create(params: GroupPanelPartInitParameters, disposer: () => void) {
    super.create(params, disposer);
    this.setupFloatingConstriants(params.api);
  }

  protected provide: typeof this._provide = (_params) => (
    <DockviewPanelProvider staticValue={[_params.api, _params.title]}>
      <this._create />
    </DockviewPanelProvider>
  );
}

export class CustomTab
  extends CustomRenderer<TabPartInitParameters>
  implements ITabRenderer
{
  protected provide: typeof this._provide = (_params) => (
    <DockviewPanelProvider staticValue={[_params.api, _params.title]}>
      <this._create />
    </DockviewPanelProvider>
  );
}

export class CustomWatermark
  extends CustomRenderer<WatermarkRendererInitParameters>
  implements IWatermarkRenderer
{
  protected provide: typeof this._provide = (_params) => (
    <DockviewGroupProvider staticValue={[_params.group!.api]}>
      <this._create />
    </DockviewGroupProvider>
  );
}

export class CustomHeader
  extends CustomRenderer<IGroupHeaderProps>
  implements IHeaderActionsRenderer
{
  protected provide: typeof this._provide = (_params) => (
    <DockviewGroupProvider staticValue={[_params.api]}>
      <this._create />
    </DockviewGroupProvider>
  );
}
