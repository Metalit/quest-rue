import { arrowPath, arrowRightOnRectangle } from "solid-heroicons/outline";
import { createEffect } from "solid-js";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoPropertyInfo,
} from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { ActionButton } from "../input/ActionButton";
import { ValueCell } from "./ValueCell";

interface PropertyCellProps {
  property: ProtoPropertyInfo;
  selection: ProtoDataPayload;
  value?: ProtoDataSegment;
  setValue: (data?: ProtoDataSegment) => void;
}

export function PropertyCell(props: PropertyCellProps) {
  const [getResult, getLoading, getValue] =
    useRequestAndResponsePacket<InvokeMethodResult>();
  const [setResult, setLoading, setValue] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (type: "Get" | "Set", result?: InvokeMethodResult) =>
    result?.error && toast.error(`${type} property error: ${result.error}`);
  createEffect(() => {
    showError("Get", getResult());
    if (getResult()) props.setValue(getResult()?.result?.data);
  });
  createEffect(() => showError("Set", setResult()));

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
    props.value &&
    setValue({
      invokeMethod: {
        inst: props.selection,
        methodId: props.property.setterId,
        args: [{ data: props.value, typeInfo: props.property.type }],
        generics: [],
      },
    });

  return (
    <div class="flex items-center justify-between">
      <span class="mono grow min-w-0" title={props.property.name}>
        {props.property.name}
      </span>
      <div class="join w-3/5 shrink-0 justify-end">
        <ValueCell
          class="join-item"
          readonly={!props.property.setterId}
          typeInfo={props.property.type!}
          onChange={props.setValue}
          value={props.value}
        />
        <ActionButton
          class="join-item btn btn-sm btn-square"
          img={arrowPath}
          tooltip="Get Value"
          loading={getLoading()}
          onClick={get}
          disabled={!props.property.getterId}
        />
        <ActionButton
          class="join-item btn btn-sm btn-square"
          img={arrowRightOnRectangle}
          tooltip="Set Value"
          loading={setLoading()}
          onClick={set}
          disabled={!props.property.setterId}
        />
      </div>
    </div>
  );
}
