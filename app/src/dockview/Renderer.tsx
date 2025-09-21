import {
  GroupPanelPartInitParameters,
  IContentRenderer,
  IGroupHeaderProps,
  IHeaderActionsRenderer,
  ITabRenderer,
  IWatermarkRenderer,
  TabPartInitParameters,
  WatermarkRendererInitParameters,
} from "dockview-core";
import { Component, createRoot, JSX, Owner } from "solid-js";

import {
  DockviewGroupContext,
  DockviewPanelContext,
  makeDockviewGroupInterface,
  makeDockviewPanelInterface,
} from "./api";

abstract class CustomRenderer<T> {
  _element: HTMLElement | undefined;
  _dispose: (() => void) | undefined;

  private create(params: T, disposer: () => void) {
    this._dispose = disposer;
    this._element = (
      <div class="overflow-auto size-full">{this.provide(params)}</div>
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
  _provide: (_params: T) => JSX.Element = () => <this._create />;
  provide: typeof this._provide = this._provide;
}

export class CustomPanel
  extends CustomRenderer<GroupPanelPartInitParameters>
  implements IContentRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewPanelContext.Provider
      value={makeDockviewPanelInterface(_params.api)}
    >
      <this._create />
    </DockviewPanelContext.Provider>
  );
}

export class CustomTab
  extends CustomRenderer<TabPartInitParameters>
  implements ITabRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewPanelContext.Provider
      value={makeDockviewPanelInterface(_params.api)}
    >
      <this._create />
    </DockviewPanelContext.Provider>
  );
}

export class CustomWatermark
  extends CustomRenderer<WatermarkRendererInitParameters>
  implements IWatermarkRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewGroupContext.Provider
      value={makeDockviewGroupInterface(_params.group!.api)}
    >
      <this._create />
    </DockviewGroupContext.Provider>
  );
}

export class CustomHeader
  extends CustomRenderer<IGroupHeaderProps>
  implements IHeaderActionsRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewGroupContext.Provider
      value={makeDockviewGroupInterface(_params.api)}
    >
      <this._create />
    </DockviewGroupContext.Provider>
  );
}
