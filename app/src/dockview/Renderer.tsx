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

import { DockviewGroupProvider, DockviewPanelProvider } from "./Api";

abstract class CustomRenderer<T> {
  _element: HTMLElement | undefined;
  _dispose: (() => void) | undefined;

  private create(params: T, disposer: () => void) {
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
  _provide: (_params: T) => JSX.Element = () => <this._create />;
  provide: typeof this._provide = this._provide;
}

export class CustomPanel
  extends CustomRenderer<GroupPanelPartInitParameters>
  implements IContentRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewPanelProvider staticValue={[_params.api]}>
      <this._create />
    </DockviewPanelProvider>
  );
}

export class CustomTab
  extends CustomRenderer<TabPartInitParameters>
  implements ITabRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewPanelProvider staticValue={[_params.api]}>
      <this._create />
    </DockviewPanelProvider>
  );
}

export class CustomWatermark
  extends CustomRenderer<WatermarkRendererInitParameters>
  implements IWatermarkRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewGroupProvider staticValue={[_params.group!.api]}>
      <this._create />
    </DockviewGroupProvider>
  );
}

export class CustomHeader
  extends CustomRenderer<IGroupHeaderProps>
  implements IHeaderActionsRenderer
{
  provide: typeof this._provide = (_params) => (
    <DockviewGroupProvider staticValue={[_params.api]}>
      <this._create />
    </DockviewGroupProvider>
  );
}
