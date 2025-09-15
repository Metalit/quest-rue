/* eslint-disable solid/style-prop */
import { Icon } from "solid-heroicons";
import { For, ParentProps, Setter } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { Portal } from "solid-js/web";

import { IconPath, uniqueNumber } from "../../global/utils";

export type DropdownPositions =
  | "start"
  | "center"
  | "end"
  | "bottom"
  | "top"
  | "left"
  | "right";

const Title = (props: { title: string }) => (
  <span class="text-sm text-secondary-content p-1">{props.title}</span>
);

export function FilterOptions(props: {
  setFilters: SetStoreFunction<Record<string, boolean>>;
  filters: Record<string, boolean>;
  title: string;
}) {
  return (
    <>
      <Title title={props.title} />
      <For each={Object.keys(props.filters)}>
        {(filter) => (
          <label class="label mx-1 last:mb-1">
            <input
              type="checkbox"
              class="toggle toggle-sm toggle-accent"
              checked={props.filters[filter]}
              use:onCheck={(value) => props.setFilters(filter, value)}
            />
            {filter}
          </label>
        )}
      </For>
    </>
  );
}

export function ModeOptions<T extends string>(props: {
  current: T;
  setCurrent: Setter<T>;
  modes: readonly T[];
  title: string;
}) {
  return (
    <>
      <Title title={props.title} />
      <For each={props.modes}>
        {(mode) => (
          <button
            class={`btn btn-sm ${mode === props.current ? "btn-accent" : ""}`}
            onClick={() => props.setCurrent(() => mode)}
          >
            {mode}
          </button>
        )}
      </For>
    </>
  );
}

export function DropdownButton(
  props: ParentProps<{
    icon: IconPath;
    title?: string;
    class?: string;
    dropdownClass?: string;
    dropdownPosition?: DropdownPositions | DropdownPositions[];
  }>,
) {
  const id = uniqueNumber();

  const pos = () => props.dropdownPosition ?? "start";

  return (
    <button
      class={`btn btn-square ${props.class ?? ""}`}
      style={`anchor-name:--drpdn-anchor-${id}`}
      popovertarget={`drpdn-pop-${id}`}
      title={props.title}
    >
      <Icon path={props.icon} />
      <Portal mount={document.getElementById("app")!}>
        <div
          class={`dropdown dropdown-${pos()} floating-menu flex flex-col p-1 gap-1 items-stretch ${props.dropdownClass ?? ""}`}
          style={`position-anchor:--drpdn-anchor-${id}`}
          popover
          id={`drpdn-pop-${id}`}
        >
          {props.children}
        </div>
      </Portal>
    </button>
  );
}
