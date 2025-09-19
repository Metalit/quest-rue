import { IGroupHeaderProps, TabPartInitParameters } from "dockview-core";
import { Icon } from "solid-heroicons";
import {
  arrowsPointingIn,
  arrowsPointingOut,
  xMark,
} from "solid-heroicons/outline";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { Dockview, DockviewPanel } from "../components/Dockview";
import { clearDetailsCache } from "../global/cache";
import { updateGameObjects } from "../global/hierarchy";
import { clearSelections } from "../global/selection";
import { Console } from "../panels/Console";
import { Hierarchy } from "../panels/Hierarchy";
import { Selection } from "../panels/Selection";
import { Variables } from "../panels/Variables";

// eslint-disable-next-line solid/no-destructure
function RightHeader({ api }: IGroupHeaderProps) {
  const [fullscreen, setFullscreen] = createSignal(api.isMaximized());
  const [inGrid, setInGrid] = createSignal(api.location.type == "grid");
  const { dispose } = api.onDidLocationChange(({ location }) =>
    setInGrid(location.type == "grid"),
  );
  onCleanup(dispose);

  const toggle = () => {
    api.isMaximized() ? api.exitMaximized() : api.maximize();
    setFullscreen(api.isMaximized());
  };

  return (
    <div class="flex items-center mr-2 h-full">
      <Show when={inGrid()}>
        <button class="btn btn-square btn-ghost btn-xs" onClick={toggle}>
          <Icon path={fullscreen() ? arrowsPointingIn : arrowsPointingOut} />
        </button>
      </Show>
    </div>
  );
}

// eslint-disable-next-line solid/no-destructure
function Tab({ api }: TabPartInitParameters) {
  const [title, setTitle] = createSignal(api.title ?? api.id);
  const dispose = api.onDidTitleChange((e) => setTitle(e.title));
  onCleanup(() => dispose.dispose());
  return (
    <div class="flex gap-2 items-center h-full hover:*:visible">
      {title()}
      <button
        class="invisible btn btn-square btn-ghost btn-xs"
        onClick={() => api.close()}
      >
        <Icon path={xMark} />
      </button>
    </div>
  );
}

export default function SceneViewer() {
  onMount(() => {
    updateGameObjects();
  });

  onCleanup(() => {
    clearDetailsCache();
    clearSelections();
  });

  return (
    <div class="size-full p-1 bg">
      <Dockview
        panels={{
          console: Console,
          hierarchy: Hierarchy,
          selection: Selection,
          variables: Variables,
        }}
        rightHeader={RightHeader}
        tabs={{
          default: Tab,
        }}
        options={{ floatingGroupBounds: "boundedWithinViewport" }}
      >
        <DockviewPanel component="selection" id="selection" title="Selection" />
        <DockviewPanel
          component="variables"
          id="variables"
          title="Variables"
          position={{ referencePanel: "selection", direction: "left" }}
          initialWidth={200}
        />
        <DockviewPanel
          component="hierarchy"
          id="hierarchy"
          title="Hierarchy"
          position={{ referencePanel: "selection", direction: "right" }}
          initialWidth={300}
        />
        <DockviewPanel
          component="console"
          id="console"
          title="Console"
          position={{ referencePanel: "selection", direction: "below" }}
          initialHeight={300}
        />
      </Dockview>
    </div>
  );
}
