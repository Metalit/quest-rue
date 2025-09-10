/* eslint-disable solid/style-prop */
import { Icon } from "solid-heroicons";
import { JSX, ParentProps } from "solid-js";
import { Portal } from "solid-js/web";

let counter = 0;

export type DropdownPositions =
  | "start"
  | "center"
  | "end"
  | "bottom"
  | "top"
  | "left"
  | "right";

export function DropdownButton(
  props: ParentProps<{
    icon: { path: JSX.Element; outline: boolean; mini: boolean };
    title?: string;
    class?: string;
    dropdownClass?: string;
    dropdownPosition?: DropdownPositions | DropdownPositions[];
  }>,
) {
  const id = counter++;

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
          class={`dropdown dropdown-${pos()} floating-menu flex flex-col p-1 gap-1 items-${pos()} ${props.dropdownClass ?? ""}`}
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
