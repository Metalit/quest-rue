/* eslint-disable solid/style-prop */
import { Icon } from "solid-heroicons";
import { For, ParentProps, Setter, splitProps } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { Portal } from "solid-js/web";

import { chevronDown } from "solid-heroicons/outline";
import {
  IconPath,
  instantHidePopover,
  setTrigger,
  Trigger,
  uniqueNumber,
} from "../../global/utils";

const dropdownPositions = {
  start: "dropdown-start",
  center: "dropdown-center",
  end: "dropdown-end",
  bottom: "dropdown-bottom",
  top: "dropdown-top",
  left: "dropdown-left",
  right: "dropdown-right",
};

export type DropdownPositions = keyof typeof dropdownPositions;

export const dropdownPosition = (pos?: DropdownPositions) =>
  dropdownPositions[pos ?? "start"];

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
            class={`btn ${mode === props.current ? "btn-accent" : ""}`}
            onClick={() => props.setCurrent(() => mode)}
          >
            {mode}
          </button>
        )}
      </For>
    </>
  );
}

type DropdownButtonProps = ParentProps<{
  icon: IconPath;
  text?: string;
  textFirst?: boolean;
  title?: string;
  class?: string;
  disabled?: boolean;
  dropdownClass?: string;
  dropdownPosition?: DropdownPositions;
  hideTrigger?: Trigger;
}>;

export function DropdownButton(props: DropdownButtonProps) {
  let popover!: HTMLDivElement;

  const id = uniqueNumber();

  const pos = () => dropdownPositions[props.dropdownPosition ?? "start"];

  setTrigger(
    () => props.hideTrigger,
    () => popover.hidePopover(),
  );

  return (
    <button
      class={`btn ${props.text ? "" : "btn-square"} ${props.class ?? ""}`}
      style={`anchor-name:--drpdn-anchor-${id}`}
      popovertarget={`drpdn-pop-${id}`}
      title={props.title}
      disabled={props.disabled}
      use:onHide={() => instantHidePopover(popover)}
    >
      {props.textFirst ? (props.text ?? "") : ""}
      <Icon path={props.icon} />
      {!props.textFirst ? (props.text ?? "") : ""}
      <Portal mount={document.getElementById("app")!}>
        <div
          class={`dropdown ${pos()} floating-menu flex flex-col p-1 gap-1 items-stretch ${props.dropdownClass ?? ""}`}
          style={`position-anchor:--drpdn-anchor-${id}`}
          popover
          ref={popover}
          id={`drpdn-pop-${id}`}
        >
          {props.children}
        </div>
      </Portal>
    </button>
  );
}

export function SideDropdownButton(
  props: DropdownButtonProps & { mainTitle: string; onMainClick: () => void },
) {
  const [main, dropdown] = splitProps(props, [
    "class",
    "icon",
    "text",
    "textFirst",
    "mainTitle",
    "onMainClick",
  ]);

  return (
    <div class="join">
      <button
        class={`join-item btn ${props.text ? "" : "btn-square"} ${main.class}`}
        title={main.mainTitle}
        onClick={() => main.onMainClick()}
      >
        {main.textFirst ? (main.text ?? "") : ""}
        <Icon path={main.icon} />
        {!main.textFirst ? (main.text ?? "") : ""}
      </button>
      <DropdownButton
        class="join-item w-5 px-1"
        icon={chevronDown}
        {...dropdown}
      />
    </div>
  );
}
