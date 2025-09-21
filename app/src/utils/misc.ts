import toast from "solid-toast";

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

export function instantHidePopover(popover: HTMLDivElement) {
  popover.style.transition = "none";
  popover.hidePopover();
  window.getComputedStyle(popover).transition;
  popover.style.transition = "";
}
