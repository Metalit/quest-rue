import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "solid-heroicons";
import {
  cog_6Tooth,
  minus,
  stop,
  viewColumns,
  window as windowIcon,
  xMark,
} from "solid-heroicons/outline";
import { ParentProps, Show } from "solid-js";

import { DropdownButton } from "../components/input/DropdownButton";
import SegmentedControl from "../components/input/SegmentedControl";
import { updateGameObjects } from "../global/hierarchy";
import {
  columnCount,
  darkMode,
  monoFont,
  setColumnCount,
  setDarkMode,
  setMonoFont,
} from "../global/settings";
import { socket } from "../global/socket";
import { IconPath } from "../global/utils";

function OptionsMenu() {
  return (
    <>
      <button
        class="btn btn-sm"
        disabled={!socket.connected()}
        onClick={() => socket.disconnect()}
      >
        Disconnect
      </button>
      <div class="divider" />
      <input
        class="input input-sm"
        placeholder="Hierarcy Refresh Interval"
        disabled
      />
      <button
        class="btn btn-sm"
        disabled={!socket.connected()}
        onClick={updateGameObjects}
      >
        Refresh Hierarchy
      </button>
      <div class="divider" />
      <label class="label mx-1 text-sm">
        <input type="checkbox" class="toggle toggle-sm" disabled />
        Remember Selection
      </label>
      <div class="divider" />
      <button class="btn btn-sm" disabled>
        Reset Member Pins
      </button>
    </>
  );
}

function ViewMenu() {
  return (
    <>
      <label class="label m-1 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-sm"
          checked={darkMode()}
          use:onCheck={setDarkMode}
        />
        Dark Mode
      </label>
      <input
        class="input input-sm"
        placeholder="Monospace Font"
        use:valueSignal={[monoFont, setMonoFont]}
      />
      <SegmentedControl
        class="ml-1.5 my-1 text-sm"
        title="Columns"
        values={[1, 2, 3]}
        value={columnCount()}
        onChange={setColumnCount}
      />
    </>
  );
}

function LayoutMenu() {
  return (
    <>
      <button class="btn btn-sm" disabled>
        Save Layout
      </button>
      <button class="btn btn-sm" disabled>
        Load Layout
      </button>
    </>
  );
}

function MenuDropdown(props: ParentProps<{ title: string; icon: IconPath }>) {
  return (
    <DropdownButton
      class="btn-ghost btn-sm rounded-none"
      icon={props.icon}
      text={props.title}
      title={props.title}
      dropdownClass="p-2"
    >
      {props.children}
    </DropdownButton>
  );
}

export function TitleBar() {
  const window = getCurrentWindow();

  return (
    <div class="flex w-screen bg-base h-8">
      <div data-tauri-drag-region class="flex gap-2 px-1 items-center">
        <img class="size-8 pointer-events-none" src="/icon.png" alt="" />
        <span class="text-sm pt-1 pointer-events-none">Quest RUE</span>
      </div>
      <MenuDropdown icon={cog_6Tooth} title="Options">
        <OptionsMenu />
      </MenuDropdown>
      <MenuDropdown icon={viewColumns} title="View">
        <ViewMenu />
      </MenuDropdown>
      <Show when={socket.connected()}>
        <MenuDropdown icon={windowIcon} title="Layout">
          <LayoutMenu />
        </MenuDropdown>
      </Show>
      <div data-tauri-drag-region class="grow" />
      <button
        class="btn btn-square btn-ghost btn-sm rounded-none"
        onClick={() => window.minimize()}
      >
        <Icon path={minus} />
      </button>
      <button
        class="btn btn-square btn-ghost btn-sm rounded-none"
        onClick={() => window.toggleMaximize()}
      >
        <Icon path={stop} />
      </button>
      <button
        class="btn btn-square btn-ghost btn-sm rounded-none"
        onClick={() => window.close()}
      >
        <Icon path={xMark} />
      </button>
    </div>
  );
}
