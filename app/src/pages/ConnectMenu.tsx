import { arrowPath, star } from "solid-heroicons/outline";
import { star as starFilled } from "solid-heroicons/solid";
import {
  createEffect,
  createRenderEffect,
  createSignal,
  For,
  Show,
} from "solid-js";

import { ActionButton } from "../components/input/ActionButton";
import { adbDevices, adbForward, hasAdb } from "../global/adb";
import { socket } from "../global/socket";
import { createAsyncMemo, createPersistentSignal } from "../utils/solid";

export default function ConnectMenu() {
  const [ip, setIp] = createPersistentSignal(
    "connect.address",
    () => "192.168.0.1",
  );
  const [port, setPort] = createPersistentSignal("connect.port", () => "3306");

  const [defaultAdbDevice, setDefaultAdbDevice] = createPersistentSignal(
    "adb.default",
    () => "",
  );

  const [adb, setAdb] = createSignal<string>();

  const [devices, devicesLoading, updateDevices] = createAsyncMemo(async () => {
    if (!adb()) return undefined;
    return await adbDevices();
  });

  // run immediately
  createRenderEffect(() => hasAdb().then(setAdb));

  // remember if adb should reconnect on forced disconnect
  const [adbConnection, setAdbConnection] = createSignal(false);

  const connect = (ip: string, port: string, display = "") => {
    if (socket.connecting()) return;
    if (display.length === 0) display = `${ip}:${port}`;
    socket.connect(ip, Number.parseInt(port), display);
  };

  const submit = (e: Event) => {
    // Stop refresh
    e.preventDefault();
    setAdbConnection(false);
    connect(ip(), port());
  };

  const selectDevice = (id: string, name: string) => {
    setAdbConnection(true);
    adbForward(id, port()).then(() => connect("localhost", port(), name));
  };

  const cancel = () => {
    socket.disconnect();
  };

  createEffect(() => {
    if (socket.manualDisconnect || !adbConnection()) return;
    const defInfo = devices()?.find(([id]) => defaultAdbDevice() === id);
    if (defInfo) selectDevice(...defInfo);
  });

  return (
    <div class="center-child">
      <div class="bg-base flex gap-5 p-2.5 rounded-lg">
        <Show
          when={!socket.connecting()}
          // when={false}
          fallback={
            <button class="btn btn-lg" onClick={cancel}>
              Cancel connection
            </button>
          }
        >
          <form onSubmit={submit} class={"flex flex-col gap-2.5"}>
            <text class="text-center">Enter your Device IP Address</text>
            <input
              class="input input-lg"
              placeholder="IP"
              value={ip()}
              onInput={(e) => {
                setIp(e.currentTarget.value);
              }}
            />
            <input
              class="input input-lg"
              type="number"
              min={0}
              max={65535}
              placeholder="Port"
              value={port()}
              onInput={(e) => {
                setPort(e.currentTarget.value);
              }}
            />
            <button class="btn btn-lg" type="submit">
              Connect
            </button>
          </form>
          <Show when={adb()}>
            <div class={"flex flex-col gap-2.5"}>
              <text class="text-center">Select ADB Device</text>
              <div
                class={
                  "bg-base-50 p-2.5 rounded-lg grow flex flex-col gap-2.5 overflow-auto"
                }
              >
                <For each={devices()}>
                  {([id, name]) => (
                    <span class="flex join-horizontal">
                      <button
                        title={id}
                        class="btn btn-lg join-item grow"
                        onClick={() => {
                          selectDevice(id, name);
                        }}
                      >
                        {name}
                      </button>
                      <ActionButton
                        img={defaultAdbDevice() === id ? starFilled : star}
                        onClick={() => {
                          // always connect when favoriting something, even after cancel/disconnect
                          if (socket.manualDisconnect)
                            socket.manualDisconnect = false;
                          setDefaultAdbDevice((old) => (id === old ? "" : id));
                        }}
                        class="btn btn-lg btn-square join-item"
                        tooltip="Set as favorite"
                      />
                    </span>
                  )}
                </For>
                <span class="grow -mb-3" />
                <ActionButton
                  img={arrowPath}
                  class="btn btn-sm btn-square self-start"
                  loading={devicesLoading()}
                  onClick={updateDevices}
                />
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
