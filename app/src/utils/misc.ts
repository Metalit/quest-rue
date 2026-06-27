import { toast } from "solid-toast";

import { AddPanelCustom, DockviewInterface } from "../dockview/Api";

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

export function toBase64(arr: Uint8Array) {
  const bin: string[] = [];
  arr.forEach((byte) => {
    bin.push(String.fromCharCode(byte));
  });
  return btoa(bin.join(""));
}

export function fromBase64(base64: string) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
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

export function openFloatingByClick(
  event: MouseEvent,
  api: DockviewInterface,
  panel: string,
  options?: Omit<AddPanelCustom, "position" | "floating">,
) {
  api.addPanel(panel, {
    floating: { x: event.x - 10, y: event.y - 50 },
    ...options,
  });
}
