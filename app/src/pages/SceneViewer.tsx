import { IGroupHeaderProps } from "dockview-core";
import { Icon } from "solid-heroicons";
import { arrowsPointingIn, arrowsPointingOut } from "solid-heroicons/outline";
import { createSignal, onCleanup, Show } from "solid-js";

import { Console } from "../components/Console";
import { Dockview, DockviewPanel } from "../components/Dockview";
import { Hierarchy } from "../components/Hierarchy";
import { Selection } from "../components/Selection";
import { Variables } from "../components/Variables";

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
        <span
          class="w-6 p-1 hover:bg-shadow rounded-xs cursor-pointer"
          onClick={toggle}
          onKeyPress={toggle}
          role="button"
          tabIndex={0}
        >
          <Icon path={fullscreen() ? arrowsPointingIn : arrowsPointingOut} />
        </span>
      </Show>
    </div>
  );
}

export default function SceneViewer() {
  return (
    <div class="w-full h-full p-1 bg">
      <Dockview
        panels={{
          console: Console,
          hierarchy: Hierarchy,
          selection: Selection,
          variables: Variables,
        }}
        rightHeader={RightHeader}
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
