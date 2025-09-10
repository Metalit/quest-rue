/* eslint-disable solid/style-prop */
import {
  batch,
  createEffect,
  createSignal,
  For,
  JSX,
  splitProps,
} from "solid-js";
import { DropdownPositions } from "./DropdownButton";
import { createUpdatingSignal } from "../../global/utils";
import { Portal } from "solid-js/web";

let counter = 0;

interface SelectInputProps<T>
  extends Omit<
    JSX.InputHTMLAttributes<HTMLInputElement>,
    "ref" | "onInput" | "onChange" | "onFocus" | "onBlur" | "value"
  > {
  options: T[];
  value: T;
  showUndefined?: boolean;
  equals?: (a: T, b: T) => boolean;
  display?: (value: T) => string;
  onInput?: (value: string) => void;
  onChange?: (value: T) => void;
  dropdownPosition?: DropdownPositions | DropdownPositions[];
}

export function SelectInput<T = string>(props: SelectInputProps<T>) {
  let input!: HTMLInputElement;
  let menu!: HTMLDivElement;

  const id = counter++;

  const [custom, others] = splitProps(props, [
    "options",
    "value",
    "showUndefined",
    "equals",
    "display",
    "onInput",
    "onChange",
    "dropdownPosition",
  ]);

  const [value, setValue] = createSignal("");
  const [selected, setSelected] = createUpdatingSignal(() => custom.value, {
    equals: false,
  });
  const [focused, setFocused] = createSignal(false);
  const [tempHide, setTempHide] = createSignal(false);
  const [frozenOptions, setFrozenOptions] = createSignal<T[]>();

  const options = () =>
    custom.showUndefined ? [undefined!, ...custom.options] : custom.options;

  const display = (value: T) => custom.display?.(value) ?? `${value}`;
  const equals = (a: T, b: T) => custom.equals?.(a, b) ?? a == b;

  createEffect(() => setValue(display(selected())));
  createEffect(() => custom.onInput?.(value()));

  const focusIn = () => {
    batch(() => {
      if (!focused()) {
        setValue("");
        setFrozenOptions(undefined);
      }
      setFocused(true);
    });
  };
  const focusOut = (e: FocusEvent) => {
    if (
      input.contains(e.relatedTarget as unknown as Node) ||
      menu.contains(e.relatedTarget as unknown as Node)
    )
      return;
    batch(() => {
      setFocused(false);
      setTempHide(false);
      setFrozenOptions((opts) => opts ?? options());
      setValue(display(selected()));
    });
  };

  // need options.source to have correct tab order with a portal
  createEffect(() =>
    focused() && !tempHide() ? menu.showPopover() : menu.hidePopover(),
  );

  return (
    <>
      <input
        {...others}
        ref={input}
        onFocus={focusIn}
        onBlur={focusOut}
        onInput={(e) => setValue(e.target.value)}
        value={value()}
        style={`anchor-name:--sel-in-anchor-${id}`}
      />
      <Portal mount={document.getElementById("app")!}>
        <div
          ref={menu}
          onFocusIn={focusIn}
          onFocusOut={focusOut}
          class={`dropdown dropdown-${custom.dropdownPosition ?? "start"} floating-menu flex flex-col p-1 gap-1`}
          popover="manual"
          style={`position-anchor:--sel-in-anchor-${id}`}
        >
          <For each={frozenOptions() ?? options()}>
            {(option) => (
              <button
                class={`btn btn-sm ${equals(option, selected()) ? "btn-accent" : ""}`}
                onClick={() => {
                  batch(() => {
                    setFrozenOptions(options());
                    setSelected(() => option);
                    setTempHide(true);
                    custom.onChange?.(option);
                  });
                }}
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
