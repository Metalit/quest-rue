import { createResizeObserver } from "@solid-primitives/resize-observer";
import { createRenderEffect } from "solid-js";

export function onInput(
  element: HTMLInputElement,
  value: () => (value: string) => void,
) {
  element.addEventListener("input", (e) =>
    value()((e.target as HTMLInputElement).value),
  );
}

export function valueSignal(
  element: HTMLInputElement,
  value: () => [() => string, (value: string) => void],
) {
  createRenderEffect(() => (element.value = value()[0]()));
  onInput(element, () => value()[1]);
}

export function onCheck(
  element: HTMLInputElement,
  value: () => (value: boolean) => void,
) {
  element.addEventListener("change", (e) =>
    value()((e.target as HTMLInputElement).checked),
  );
}

export function onEnter(element: HTMLElement, value: () => () => void) {
  element.addEventListener("keypress", (e) => e.key == "Enter" && value()());
}

export function onHide(element: HTMLElement, value: () => () => void) {
  createResizeObserver(
    element,
    ({ width, height }) => width == 0 && height == 0 && value()(),
  );
}

type DirectiveFn = (element: never, accessor: () => never) => void;
type DirectiveArg<T extends DirectiveFn> = ReturnType<Parameters<T>[1]>;

// for now, directives have to be added here AND vite.config.ts
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      onInput: DirectiveArg<typeof onInput>;
      valueSignal: DirectiveArg<typeof valueSignal>;
      onCheck: DirectiveArg<typeof onCheck>;
      onEnter: DirectiveArg<typeof onEnter>;
      onHide: DirectiveArg<typeof onHide>;
    }
  }
}
