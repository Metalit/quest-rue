import {
  Accessor,
  batch,
  createEffect,
  createRenderEffect,
  createSignal,
  Signal,
  SignalOptions,
} from "solid-js";

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
  equals: (v1?: T, v2?: T) => boolean,
  toString: (value?: T) => string,
  fromString: (input: string) => T,
  valid?: (input: string) => boolean,
) {
  const [input, setInput] = createSignal("");

  const validInput = () => !valid || valid(input());

  // eslint-disable-next-line solid/reactivity
  let lastParsedInput = validInput() ? fromString(input()) : undefined;

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
): [Accessor<T | undefined>, Accessor<boolean>, () => Promise<void>] {
  // TODO: Use createResource or handle errors properly
  const [valAccessor, valSetter] = createSignal<T>();
  const [loading, setLoading] = createSignal(true);
  const fetch = async () => {
    setLoading(true);
    // resolve promise before setter
    const v = await valPromise();
    batch(() => {
      setLoading(false);
      valSetter(() => v);
    });
  };
  // run even if inital render phase
  // we use effect to listen to changes
  createRenderEffect(fetch);
  return [valAccessor, loading, fetch];
}

export type Trigger<T extends unknown[] = []> = {
  trigger: (...params: T) => void;
};

/**
 * Create an object that can be passed to a component and will cause an action
 *
 */
export function createTrigger<T extends unknown[] = []>(): Trigger<T> {
  return { trigger: () => {} };
}

export function setTrigger<T extends unknown[]>(
  trigger: () => Trigger<T> | undefined,
  call: Trigger<T>["trigger"],
) {
  createRenderEffect(() => trigger() && (trigger()!.trigger = call));
}
