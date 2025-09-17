import { Icon } from "solid-heroicons";
import { cog_6Tooth } from "solid-heroicons/outline";
import {
  columnCount,
  darkMode,
  monoFont,
  rawInput,
  setColumnCount,
  setDarkMode,
  setMonoFont,
  setRawInput,
} from "../global/settings";
import { socket } from "../global/socket";
import SegmentedControl from "./input/SegmentedControl";
import Toggle from "./input/Toggle";

export function SettingsMenu() {
  return (
    <div class="absolute top-2 right-5 dropdown dropdown-bottom dropdown-end flex-none">
      <button class="p-2" title="Settings">
        <Icon path={cog_6Tooth} class="size-6" />
      </button>

      <div
        class="dropdown-content shadow menu text-base
               bg-zinc-300 dark:bg-zinc-800
               justify-center gap-2 w-60 p-3
               my-2 z-10 rounded-box cursor-auto"
      >
        <Toggle
          class="h-8"
          title="Dark mode"
          value={darkMode()}
          onToggle={setDarkMode}
        />
        <span class={`flex items-center h-8`}>
          <label class="flex-1">{"Mono Font"}</label>
          <input
            class="small-input w-28"
            use:valueSignal={[monoFont, setMonoFont]}
          />
        </span>
        <Toggle
          class="h-8"
          title="Use raw input"
          value={rawInput()}
          onToggle={setRawInput}
        />
        <SegmentedControl
          class={"h-8"}
          values={["1", "2", "3", "4"]}
          onValueSelect={(val: string) => setColumnCount(Number.parseInt(val))}
          selectedValue={columnCount().toString()}
          title="Columns"
        />
        <button
          class="small-button mt-1 mb-1"
          onClick={() => {
            socket.disconnect();
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
