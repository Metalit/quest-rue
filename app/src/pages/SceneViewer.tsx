import { Icon } from "solid-heroicons";
import {
  arrowsPointingIn,
  arrowsPointingOut,
  plus,
  xMark,
} from "solid-heroicons/outline";
import { For, onCleanup, onMount, Show } from "solid-js";

import { DropdownButton } from "../components/input/DropdownButton";
import {
  useDockview,
  useDockviewGroup,
  useDockviewPanel,
} from "../dockview/Api";
import { Dockview } from "../dockview/Dockview";
import { clearDetailsCache } from "../global/cache";
import { updateGameObjects } from "../global/hierarchy";
import { clearSelections } from "../global/selection";
import { Editor } from "../panels/Editor";
import { Hierarchy } from "../panels/Hierarchy";
import { Selection } from "../panels/Selection";
import { Variables } from "../panels/Variables";
import { createTrigger } from "../utils/solid";

function RightHeader() {
  const { maximized, setMaximized, location } = useDockviewGroup();

  return (
    <div class="flex items-center mr-1.5 h-full">
      <Show when={location() == "grid"}>
        <button
          class="btn btn-square btn-ghost btn-sm"
          onClick={() => setMaximized((val) => !val)}
        >
          <Icon path={maximized() ? arrowsPointingIn : arrowsPointingOut} />
        </button>
      </Show>
    </div>
  );
}

function LeftHeader() {
  const { addPanel, templates } = useDockview();
  const { id } = useDockviewGroup();

  const hide = createTrigger();

  return (
    <div class="flex items-center ml-1.5 h-full">
      <DropdownButton icon={plus} class="btn-ghost btn-sm" hideTrigger={hide}>
        <For each={templates()}>
          {({ component, title }) => (
            <button
              class="btn"
              onClick={() => {
                hide.trigger();
                addPanel(component, {
                  title,
                  position: { referenceGroup: id, direction: "within" },
                });
              }}
            >
              {title}
            </button>
          )}
        </For>
      </DropdownButton>
    </div>
  );
}

function Tab() {
  const { title, close } = useDockviewPanel();

  return (
    <div class="flex gap-2 items-center h-full hover:*:visible">
      {title()}
      <button
        class="invisible btn btn-square btn-ghost btn-sm"
        onClick={close}
        use:stopDrag
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
    <div class="grow min-h-0 p-1 bg">
      <Dockview
        leftHeader={LeftHeader}
        rightHeader={RightHeader}
        tabs={{ default: Tab }}
        options={{ floatingGroupBounds: "boundedWithinViewport" }}
        onReady={({ addPanel }) => {
          addPanel("selection", { id: "selection" });
          addPanel("variables", {
            position: { referencePanel: "selection", direction: "left" },
            width: 200,
          });
          addPanel("hierarchy", {
            position: { referencePanel: "selection", direction: "right" },
            width: 300,
          });
        }}
      >
        {{
          selection: {
            create: Selection,
            title: "Selection",
            minimumWidth: 550,
            minimumHeight: 300,
          },
          variables: {
            create: Variables,
            title: "Variables",
            minimumWidth: 300,
            minimumHeight: 400,
          },
          hierarchy: {
            create: Hierarchy,
            title: "Hierarchy",
            minimumWidth: 200,
            minimumHeight: 300,
          },
          editor: {
            create: Editor,
            title: "Editor",
            minimumWidth: 300,
            minimumHeight: 300,
          },
        }}
      </Dockview>
    </div>
  );
}
