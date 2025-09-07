import toast from "solid-toast";
import {
  Signal,
  SignalOptions,
  createEffect,
  createSignal,
  Accessor,
  createRenderEffect,
} from "solid-js";

export type WithCase<T, C> = Extract<T, { $case: C }>;

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
  val: () => T,
  options?: SignalOptions<T>,
): Signal<T> {
  const [valAccessor, valSetter] = createSignal(val(), options);
  // reset the value when val is modified
  createEffect(() => valSetter(() => val())); // typescript is so stupid sometimes
  return [valAccessor, valSetter];
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
  const update = async () => {
    setLoading(true);
    // resolve promise before setter
    const v = await valPromise();
    setLoading(false);

    return valSetter(() => v);
  };
  // run even if inital render phase
  // we use effect to listen to changes
  createRenderEffect(update);
  return [valAccessor, loading, update];
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
