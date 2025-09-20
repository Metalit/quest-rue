import { Icon } from "solid-heroicons";
import {
  Accessor,
  createEffect,
  createRenderEffect,
  createSignal,
  Signal,
  SignalOptions,
} from "solid-js";
import toast from "solid-toast";

export type IconPath = Parameters<typeof Icon>[0]["path"];

export type WithCase<
  T extends { $case: string } | undefined,
  C extends NonNullable<T>["$case"],
> = Extract<NonNullable<T>, { $case: C }>;

type CaseValue<T, C extends string> = T extends { [k in C]: infer V }
  ? V
  : never;

// there is probably a better way to do this, typescript-wise
export function extractCase<
  T extends { $case: string } | undefined,
  C extends NonNullable<T>["$case"],
>(value: T, $case: C): CaseValue<T, C> | undefined {
  return (value as { [k in C]: CaseValue<T, C> } | undefined)?.[$case];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnionOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export function setCase<TResult>(object: UnionOmit<TResult, "$case">): TResult {
  return {
    ...object,
    $case: Object.keys(object)[0],
  } as TResult; // could probably be done without the cast with some typescript magic but idc
}

/**
 * A signal that resets its value when its dependencies change
 *
 */
export function createUpdatingSignal<T>(
  value: () => T,
  options?: SignalOptions<T>,
): Signal<T> {
  const [valAccessor, valSetter] = createSignal(value(), options);
  // reset the value when val is modified (extra function calls because T *could* be a function itself)
  createEffect(() => valSetter(() => value()));
  return [valAccessor, valSetter];
}

/**
 * Creates a signal that represents a parsed value, that may be modified by changing the value or the parsed string
 * Allows for the user to type input for a value without their input being reformatted, while reactively updating
 * if the value changes from an outside source
 *
 */
export function createUpdatingParser<T>(
  value: () => T | undefined,
  setValue: (value: T) => void,
  equals: (v1: T | undefined, v2: T | undefined) => boolean,
  toString: (value: T | undefined) => string,
  fromString: (input: string) => T,
  valid?: (input: string) => boolean,
) {
  const [input, setInput] = createSignal("");

  const validInput = () => !valid || valid(input());

  let lastParsedInput: T | undefined = undefined;

  // each time a new value is input, parse it and update (if valid)
  createEffect(() => {
    if (!validInput()) return;
    const parsedInput = fromString(input());
    if (!equals(parsedInput, lastParsedInput)) {
      lastParsedInput = parsedInput;
      setValue(parsedInput);
    }
  });

  // update if the value changed from the outside source
  createEffect(() => {
    const newValue = value();
    if (!equals(lastParsedInput, newValue)) {
      lastParsedInput = newValue; // prevent sending unnecessary updates
      setInput(toString(newValue));
    }
  });

  return [input, setInput, validInput] as const;
}

/**
 * Stores the signal value in browser local storage
 * Uses the default value if none exists prior to use
 *
 */
export function createPersistentSignal<T>(
  key: string,
  defaultVal: () => T,
  fromString?: (value: string) => T,
  toString?: (value: T) => string,
  options?: SignalOptions<T>,
): Signal<T> {
  const stored = localStorage.getItem(key);
  const [val, setVal] = createSignal(
    stored ? (fromString?.(stored) ?? (stored as T)) : defaultVal(),
    options,
  );
  createEffect(() => {
    localStorage.setItem(key, toString ? toString(val()) : String(val()));
  });
  return [val, setVal];
}

/**
 * Create a memo that resolves a promise or undefined if no value
 *
 * Important: anything reactive used after an await will not be tracked
 *
 */
export function createAsyncMemo<T>(
  valPromise: () => Promise<T>,
): [Accessor<T | undefined>, Accessor<boolean>, () => Promise<T>] {
  // TODO: Use createResource or handle errors properly
  const [valAccessor, valSetter] = createSignal<T>();
  const [loading, setLoading] = createSignal(true);
  const fetch = async () => {
    setLoading(true);
    // resolve promise before setter
    const v = await valPromise();
    setLoading(false);

    return valSetter(() => v);
  };
  // run even if inital render phase
  // we use effect to listen to changes
  createRenderEffect(fetch);
  return [valAccessor, loading, fetch];
}

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
    }
  }
}

export function uniqueNumber(min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.floor(Math.random() * (max - min) + min);
}

export function uniqueBigNumber(min = 0, max = Number.MAX_SAFE_INTEGER) {
  return BigInt(uniqueNumber(min, max));
}

export function bigToString(num: bigint) {
  return `0x${num.toString(16)}`;
}

export function stringToBig(num: string) {
  return BigInt(num);
}

export function errorHandle<R, T extends () => R>(func: T) {
  try {
    return func();
  } catch (e) {
    toast.error(`Suffered from error: ${e}`);
    throw e;
  }
}

export function isTauri(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsafeWindow = window as any;
  return (
    (unsafeWindow.isTauri || unsafeWindow.__TAURI_INTERNALS__) != undefined
  );
}
