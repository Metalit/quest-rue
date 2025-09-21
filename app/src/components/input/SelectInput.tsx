/* eslint-disable solid/style-prop */
import {
  batch,
  createEffect,
  createSignal,
  For,
  JSX,
  splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";

import { instantHidePopover, uniqueNumber } from "../../utils/misc";
import { createUpdatingSignal } from "../../utils/solid";
import { dropdownPosition, DropdownPositions } from "./DropdownButton";

interface SelectInputProps<V, O>
  extends Omit<
    JSX.InputHTMLAttributes<HTMLInputElement>,
    "ref" | "onInput" | "onChange" | "onFocus" | "onBlur" | "value"
  > {
  value: V;
  options: O[];
  showUndefined?: boolean;
  free?: boolean;
  equals?: (a: V, b: V) => boolean;
  display?: (value: V) => string;
  search?: ((input: string, value: O) => boolean) | "default";
  onInput?: (value: string) => void;
  onChange?: (value: V) => void;
  dropdownPosition?: DropdownPositions;
}

export function SelectInput<V = string, O extends V = V>(
  props: SelectInputProps<V, O>,
) {
  let inputElement!: HTMLInputElement;
  let menuElement!: HTMLDivElement;

  const id = uniqueNumber();

  const [custom, others] = splitProps(props, [
    "value",
    "options",
    "showUndefined",
    "free",
    "equals",
    "display",
    "search",
    "onInput",
    "onChange",
    "dropdownPosition",
    "children",
  ]);

  const [input, setInput] = createSignal("");
  const [selected, setSelected] = createUpdatingSignal(() => custom.value, {
    equals: false,
  });
  const [focused, setFocused] = createSignal(false);
  const [tempHide, setTempHide] = createSignal(false);
  const [frozenOptions, setFrozenOptions] = createSignal<O[]>();

  const search = (value: O) => {
    if (typeof custom.search == "function")
      return custom.search(input(), value);
    if (custom.search == "default" && typeof value == "string")
      return value.toLocaleLowerCase().includes(input().toLocaleLowerCase());
    return true;
  };

  const options = () =>
    frozenOptions() ??
    (custom.showUndefined
      ? [undefined!, ...custom.options]
      : custom.options
    ).filter(search);

  const display = (value: V) => custom.display?.(value) ?? `${value}`;

  const isSelected = (value: O) =>
    (custom.equals?.(value, selected()) ?? value == selected()) &&
    (!custom.free || input() == display(value));

  const select = (value: O) => {
    batch(() => {
      setFrozenOptions(options());
      setSelected(() => value);
      setTempHide(true);
      custom.onChange?.(value);
    });
  };

  createEffect(() => setInput(display(selected())));
  createEffect(() => custom.onInput?.(input()));

  let focusIdx = -1;

  const onKeyDown = (e: KeyboardEvent) => {
    const children = menuElement.childNodes as NodeListOf<HTMLElement>;
    if (e.key == "Escape") setTempHide(true);
    else if (e.key == "ArrowDown" && focusIdx < children.length - 1)
      children[++focusIdx].focus();
    else if (e.key == "ArrowUp" && focusIdx > 0) children[--focusIdx].focus();
    else if (e.key == "ArrowUp" && focusIdx == 0) inputElement.focus();
    else return;
    e.preventDefault();
  };

  const focusIn = () =>
    batch(() => {
      if (!focused()) {
        if (!custom.free) setInput("");
        setFrozenOptions(undefined);
      }
      setFocused(true);
      document.addEventListener("keydown", onKeyDown);
    });

  const focusOut = () =>
    batch(() => {
      setFocused(false);
      setTempHide(false);
      setFrozenOptions(options());
      if (!custom.free) setInput(display(selected()));
      document.removeEventListener("keydown", onKeyDown);
    });

  const checkFocusOut = (e: FocusEvent) =>
    !inputElement.contains(e.relatedTarget as unknown as Node) &&
    !menuElement.contains(e.relatedTarget as unknown as Node) &&
    focusOut();

  // need options.source to have correct tab order with a portal
  createEffect(() => {
    if (focused() && !tempHide()) menuElement.showPopover();
    else {
      menuElement.hidePopover();
      focusIdx = -1;
    }
  });

  return (
    <>
      <input
        {...others}
        style={`anchor-name:--sel-in-anchor-${id}`}
        ref={inputElement}
        onFocus={focusIn}
        onBlur={checkFocusOut}
        use:onHide={() => {
          instantHidePopover(menuElement);
          focusOut();
          inputElement.blur();
        }}
        use:valueSignal={[input, setInput]}
        use:onEnter={() => {
          if (options().length > 0) select(options()[0]);
          else if (custom.showUndefined) select(undefined!);
        }}
        onClick={(e) => {
          setTempHide(false);
          if (typeof others.onClick == "function") others.onClick(e);
        }}
        onInput={() => setTempHide(false)}
      />
      <Portal mount={document.getElementById("app")!}>
        <div
          ref={menuElement}
          onFocusIn={focusIn}
          onFocusOut={checkFocusOut}
          class={`dropdown dropdown-${dropdownPosition(custom.dropdownPosition)} floating-menu
                  flex flex-col p-1 gap-1 max-h-56 empty:transition-none empty:hidden`}
          popover="manual"
          style={`position-anchor:--sel-in-anchor-${id}`}
        >
          <For each={options()}>
            {(option) => (
              <button
                class={`btn ${isSelected(option) ? "btn-accent" : ""}`}
                onClick={() => select(option)}
              >
                {display(option)}
              </button>
            )}
          </For>
        </div>
      </Portal>
    </>
  );
}
