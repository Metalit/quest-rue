import { createEffect, Show } from "solid-js";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import { createUpdatingSignal } from "../../global/utils";
import { ProtoDataPayload, ProtoPropertyInfo } from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { ValueCell } from "./ValueCell";
import { ActionButton } from "../input/ActionButton";
import { arrowRightOnRectangle } from "solid-heroicons/outline";

interface PropertyCellProps {
  property: ProtoPropertyInfo;
  selection: ProtoDataPayload;
  skipRetrieve?: boolean;
}

export function PropertyCell(props: PropertyCellProps) {
  const [getResult, getLoading, getValue] =
    useRequestAndResponsePacket<InvokeMethodResult>();
  const [setResult, setLoading, setValue] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (type: "Get" | "Set", result?: InvokeMethodResult) =>
    result?.error && toast.error(`${type} property error: ${result.error}`);
  createEffect(() => showError("Get", getResult()));
  createEffect(() => showError("Set", setResult()));

  const [value, setInputValue] = createUpdatingSignal(
    () => getResult()?.result?.data,
  );

  const get = () =>
    props.property.getterId &&
    getValue({
      invokeMethod: {
        inst: props.selection,
        methodId: props.property.getterId,
        args: [],
        generics: [],
      },
    });

  const set = () =>
    props.property.setterId &&
    value() &&
    setValue({
      invokeMethod: {
        inst: props.selection,
        methodId: props.property.setterId,
        args: [{ data: value(), typeInfo: props.property.type }],
        generics: [],
      },
    });

  return (
    <div class="flex gap-3 items-center">
      <span class="mono w-48">{props.property.name}</span>
      <div class="join">
        <ValueCell
          class="join-item"
          input={!!props.property.setterId}
          output={!!props.property.getterId}
          typeInfo={props.property.type!}
          onChange={setInputValue}
          value={value()}
        />
        <Show when={props.property.getterId}>
          <ActionButton
            class="join-item btn btn-sm btn-square"
            img="refresh"
            tooltip="Get Value"
            loading={getLoading()}
            onClick={get}
          />
        </Show>
        <Show when={props.property.setterId}>
          <ActionButton
            class="join-item btn btn-sm btn-square"
            img={arrowRightOnRectangle}
            tooltip="Set Value"
            loading={setLoading()}
            onClick={set}
          />
        </Show>
      </div>
    </div>
  );
}
