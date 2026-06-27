import { Accessor, batch, createSignal, untrack } from "solid-js";
import toast from "solid-toast";

import { PacketWrapper } from "../proto/qrue";
import { loadRecordedData, mockHandleMessage } from "./mock";

export type Callback<T> = (value: T) => void;

abstract class QuestRUESocket {
  abstract connectImpl(
    address: string,
    port: number,
    id: number,
  ): Promise<boolean>;
  abstract disconnectImpl(): void;
  abstract sendData(wrapper: PacketWrapper): void;

  connect(address: string, port: number, toastDisplay: string | undefined) {
    if (this.connected()) console.warn("called connect on connected socket");
    batch(() => {
      this.setConnecting(true);
      this.setConnected(false);
    });
    this.manualDisconnect = false;

    if (this.loadingToast) toast.dismiss(this.loadingToast);
    this.loadingToast = undefined;
    const id = ++this.connectionId;

    const promise = this.connectImpl(address, port, id);
    if (toastDisplay)
      this.loadingToast = toast.loading(`Connecting to ${toastDisplay}`);
    return promise.catch((e) => {
      console.log(`connection failed: ${e}`);
      if (this.connectionId === id) this.onError();
      return false;
    });
  }

  disconnect() {
    if (this.loadingToast) {
      toast.dismiss(this.loadingToast);
      this.loadingToast = undefined;
    }
    batch(() => {
      this.setConnecting(false);
      this.setConnected(false);
    });
    this.manualDisconnect = true;
    this.disconnectImpl();
  }

  onConnect() {
    if (this.manualDisconnect) {
      this.disconnectImpl();
      return;
    }
    if (this.loadingToast) {
      toast.success("Connected successfully", { id: this.loadingToast });
      this.loadingToast = undefined;
    }
    batch(() => {
      this.setConnecting(false);
      this.setConnected(true);
    });
  }

  onError() {
    if (this.manualDisconnect) return;
    if (this.loadingToast) {
      toast.error("Failed to connect", { id: this.loadingToast });
      this.loadingToast = undefined;
    }
    batch(() => {
      this.setConnecting(false);
      this.setConnected(false);
    });
  }

  onDisconnect() {
    if (this.loadingToast) {
      toast.success("Disconnected", { id: this.loadingToast });
      this.loadingToast = undefined;
    }
    batch(() => {
      this.setConnecting(false);
      this.setConnected(false);
    });
  }

  onMessage(wrapper: PacketWrapper) {
    this.onPacketCallbacks.forEach((callback) => callback(wrapper));
  }

  connecting: Accessor<boolean>;
  setConnecting: (v: boolean) => void;
  connected: Accessor<boolean>;
  setConnected: (v: boolean) => void;
  manualDisconnect = false;
  connectionId = 0;
  loadingToast: string | undefined = undefined;

  constructor() {
    // eslint-disable-next-line solid/reactivity
    [this.connecting, this.setConnecting] = createSignal(false);
    // eslint-disable-next-line solid/reactivity
    [this.connected, this.setConnected] = createSignal(false);
  }

  onSendCallback: Callback<PacketWrapper> | undefined = undefined;

  sendPacket(wrapper: PacketWrapper) {
    if (!untrack(this.connected)) return;
    this.onSendCallback?.(wrapper);
    this.sendData(wrapper);
  }

  onPacketCallbacks: Callback<PacketWrapper>[] = [];

  addOnPacket(callback: Callback<PacketWrapper>) {
    this.onPacketCallbacks.push(callback);
  }

  removeOnPacket(callback: Callback<PacketWrapper>) {
    this.onPacketCallbacks = this.onPacketCallbacks.filter(
      (value) => value !== callback,
    );
  }
}

class NodeWebSocket extends QuestRUESocket {
  socket: WebSocket | undefined;

  connectImpl(ip: string, port: number, id: number): Promise<boolean> {
    // TODO: Disable requirement for secure websocket
    const url = `ws://${ip}:${port}`;

    return new Promise((res, err) => {
      const socket = new WebSocket(url);

      this.socket = socket;
      this.socket.binaryType = "arraybuffer";
      this.socket.onopen = () => {
        if (this.connectionId === id) {
          this.onConnect();
          res(true);
        } else {
          socket.close();
          res(false);
        }
      };
      this.socket.onclose = () => {
        if (this.connectionId === id) this.onDisconnect();
      };
      this.socket.onerror = (event) => {
        console.log("socket error:", event);
        err(event);
      };
      this.socket.onmessage = (event) => {
        if (this.connectionId === id)
          this.onMessage(PacketWrapper.decode(new Uint8Array(event.data)));
      };
    });
  }

  disconnectImpl() {
    this.socket?.close();
    this.socket = undefined;
  }

  sendData(packet: PacketWrapper) {
    this.socket?.send(PacketWrapper.encode(packet).finish());
  }
}

class MockWebSocket extends QuestRUESocket {
  async connectImpl(): Promise<boolean> {
    const success = await loadRecordedData();
    if (success) this.onConnect();
    return success;
  }

  disconnectImpl() {}

  sendData(wrapper: PacketWrapper) {
    mockHandleMessage(wrapper, (packet) => this.onMessage(packet));
  }
}

export const socket: QuestRUESocket =
  import.meta.env.DEV && import.meta.env.VITE_MOCK
    ? new MockWebSocket()
    : new NodeWebSocket();
