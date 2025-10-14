import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "solid-heroicons";
import {
  cog_6Tooth,
  minus,
  paintBrush,
  stop,
  viewColumns,
  xMark,
} from "solid-heroicons/outline";
import { ParentProps, Show } from "solid-js";

import { DropdownButton } from "../components/input/DropdownButton";
import SegmentedControl from "../components/input/SegmentedControl";
import { updateGameObjects } from "../global/hierarchy";
import {
  columnCount,
  darkMode,
  defaultMemberPins,
  monoFont,
  setColumnCount,
  setMemberPins,
  setMonoFont,
} from "../global/settings";
import { socket } from "../global/socket";
import { IconPath } from "../utils/typing";
import { setDarkMode } from "../global/theme";

function OptionsMenu() {
  return (
    <>
      <button
        class="btn"
        disabled={!socket.connected()}
        onClick={() => socket.disconnect()}
      >
        Disconnect
      </button>
      <div class="divider" />
      <input class="input" placeholder="Hierarcy Refresh Interval" disabled />
      <button
        class="btn"
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
      <button class="btn" onClick={() => setMemberPins(defaultMemberPins)}>
        Reset Member Pins
      </button>
    </>
  );
}

function ThemeMenu() {
  return (
    <>
      <label class="label m-1 mb-1.5 text-sm">
        <input
          type="checkbox"
          class="toggle toggle-sm"
          checked={darkMode()}
          use:onCheck={setDarkMode}
        />
        Dark Mode
      </label>
      <input
        class="input"
        placeholder="Monospace Font"
        title="Monospace Font"
        use:valueSignal={[monoFont, setMonoFont]}
      />
    </>
  );
}

function LayoutMenu() {
  return (
    <>
      <button class="btn" disabled>
        Save Layout
      </button>
      <button class="btn" disabled>
        Load Layout
      </button>
      <SegmentedControl
        class="ml-1.5 text-sm"
        title="Columns"
        values={[1, 2, 3]}
        value={columnCount()}
        onChange={setColumnCount}
      />
    </>
  );
}

function MenuDropdown(props: ParentProps<{ title: string; icon: IconPath }>) {
  return (
    <DropdownButton
      class="btn-ghost rounded-none"
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
      <MenuDropdown icon={paintBrush} title="Theme">
        <ThemeMenu />
      </MenuDropdown>
      <Show when={socket.connected()}>
        <MenuDropdown icon={viewColumns} title="Layout">
          <LayoutMenu />
        </MenuDropdown>
      </Show>
      <div data-tauri-drag-region class="grow" />
      <button
        class="btn btn-square btn-ghost rounded-none"
        onClick={() => window.minimize()}
      >
        <Icon path={minus} />
      </button>
      <button
        class="btn btn-square btn-ghost rounded-none"
        onClick={() => window.toggleMaximize()}
      >
        <Icon path={stop} />
      </button>
      <button
        class="btn btn-square btn-ghost rounded-none"
        onClick={() => window.close()}
      >
        <Icon path={xMark} />
      </button>
    </div>
  );
}
