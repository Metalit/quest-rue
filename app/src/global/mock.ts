import toast from "solid-toast";
import { PacketWrapper } from "../proto/qrue";
import { Callback, socket } from "./socket";
import { invoke } from "@tauri-apps/api/core";
import { createSignal, untrack } from "solid-js";
import { fromBase64, isTauri, toBase64 } from "../utils/misc";

let mockFile: Record<string, string> = {};

async function hashPacket(packet: PacketWrapper["Packet"]): Promise<string> {
  const data = PacketWrapper.encode({
    queryResultId: BigInt(0),
    Packet: packet,
  }).finish();
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toBase64(new Uint8Array(hash));
}

export async function mockHandleMessage(
  wrapper: PacketWrapper,
  callback: Callback<PacketWrapper>,
) {
  const { queryResultId, Packet: packet } = wrapper;
  const hash = await hashPacket(packet);
  const data = mockFile[hash];
  const response = data
    ? PacketWrapper.decode(fromBase64(data)).Packet
    : undefined;
  callback({
    queryResultId,
    Packet: response ?? {
      $case: "inputError",
      inputError: "No mock data for this request",
    },
  });
}

async function mockRecordMessage(wrapper: PacketWrapper) {
  const { queryResultId, Packet: packet } = wrapper;
  const callback: { value: (packet: PacketWrapper) => void } = {
    value: undefined!,
  };
  callback.value = async (response) => {
    if (response.queryResultId != queryResultId || !response.Packet) return;
    socket.removeOnPacket(callback.value);
    const hash = await hashPacket(packet);
    const data = PacketWrapper.encode({
      queryResultId: BigInt(0),
      Packet: response.Packet,
    }).finish();
    mockFile[hash] = toBase64(data);
  };
  socket.addOnPacket(callback.value);
}

export async function loadRecordedData() {
  try {
    const array = await invoke<ArrayBuffer>("read_mock_file");
    const fileString = new TextDecoder().decode(new Uint8Array(array));
    mockFile = JSON.parse(fileString);
    return true;
  } catch (error) {
    console.error("error reading mock file", error);
    toast.error(`Error reading mock file: ${error}`);
    return false;
  }
}

const [isRecording, setIsRecording] = createSignal(false);

export async function startRecordingData(clear: boolean) {
  if (untrack(isRecording) || !isTauri()) return;
  setIsRecording(true);
  if (clear) mockFile = {};
  else await loadRecordedData();
  socket.onSendCallback = mockRecordMessage;
}

export async function stopRecordingData() {
  if (!untrack(isRecording) || !isTauri()) return;
  socket.onSendCallback = undefined;
  setIsRecording(false);
  try {
    await invoke("write_mock_file", { contents: JSON.stringify(mockFile) });
  } catch (error) {
    toast.error(`Error writing mock file: ${error}`);
  }
}

export function isRecordingData() {
  return isRecording();
}
