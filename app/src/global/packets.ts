import {
  Accessor,
  batch,
  createSignal,
  getOwner,
  onCleanup,
  untrack,
} from "solid-js";
import toast from "solid-toast";

import { PacketWrapper } from "../proto/qrue";
import { uniqueBigNumber } from "../utils/misc";
import { UnionOmit, setCase } from "../utils/typing";
import { Callback, socket } from "./socket";

type PacketTypesFull = NonNullable<PacketWrapper["Packet"]>;
type PacketTypes = UnionOmit<PacketTypesFull, "$case">;

const setPacketCase = setCase<PacketTypesFull>;

function addCallback<TResponse>(
  success: Callback<TResponse>,
  inputError: Callback<string>,
  id: { value?: bigint },
): Callback<PacketWrapper> {
  const callback = (wrapper: PacketWrapper) => {
    if (id.value && wrapper.queryResultId === id.value) {
      if (wrapper.Packet?.$case == "inputError")
        inputError(wrapper.Packet.inputError);
      else
        // evil casting to get whatever the oneOf value is
        success(
          (wrapper.Packet as unknown as Record<string, TResponse>)[
            wrapper.Packet!.$case!
          ],
        );
      id.value = undefined;
    }
  };
  socket.addOnPacket(callback);
  if (getOwner()) onCleanup(() => socket.removeOnPacket(callback));
  return callback;
}

export function sendPacket(
  packet: PacketTypes,
  id: bigint = uniqueBigNumber(),
) {
  socket.sendPacket({
    queryResultId: id,
    Packet: setPacketCase(packet),
  });
}

// Returns a promise to get the response to a particular packet
export function sendPacketResult<TResponse>(
  packet: PacketTypes,
): [Promise<TResponse>, () => void] {
  const id = uniqueBigNumber();
  const callback: { value: Callback<PacketWrapper> } = { value: undefined! };
  const cancel = () => socket.removeOnPacket(callback.value);

  const promise = new Promise<TResponse>((res, err) => {
    callback.value = addCallback<TResponse>(
      (packet) => {
        cancel();
        res(packet);
      },
      (error) => {
        cancel();
        err(error);
      },
      { value: id },
    );
  });

  sendPacket(packet, id);

  return [promise, cancel];
}

/**
 * A hook that returns the value of a packet with a response
 * Essentially, it gives both the current state and a function to send a packet
 * When the packet is sent, it is given a unique id
 * When a packet with the same query ID is received, it updates the state
 *
 * allowConcurrent: whether to allow a new packet to be sent while still loading
 *
 * Returns: [latest response accessor, loading accessor, send new packet function]
 */
export function useRequestAndResponsePacket<TResponse>(
  allowConcurrent: boolean = true,
): [
  Accessor<TResponse | undefined>,
  Accessor<boolean>,
  (p: PacketTypes) => void,
] {
  const [value, setValue] = createSignal<TResponse | undefined>(undefined);
  const [loading, setLoading] = createSignal<boolean>(false);

  // use an object so that we can update the value later and use it in the callback
  const currentId: { value?: bigint } = {};

  addCallback<TResponse>(
    (packet) => {
      batch(() => {
        setValue(() => packet);
        setLoading(false);
      });
    },
    (error) => {
      toast.error(`Error in input: ${error}`);
      batch(() => {
        setValue(undefined);
        setLoading(false);
      });
    },
    currentId,
  );

  // Return the state and a callback for invoking reads
  const refetch = (packet: PacketTypes) => {
    if (untrack(loading) && !allowConcurrent) return;

    const id = uniqueBigNumber();
    currentId.value = id;
    setLoading(true);
    sendPacket(packet, id);
  };

  return [value, loading, refetch];
}
