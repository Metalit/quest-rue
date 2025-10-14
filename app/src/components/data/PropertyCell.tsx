import { arrowPath, arrowRightOnRectangle } from "solid-heroicons/outline";
import { createEffect, createSignal, JSX, Show } from "solid-js";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoPropertyInfo,
} from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { propertyInfoId } from "../../types/serialization";
import { ActionButton } from "../input/ActionButton";
import { CellPinButton, CellTextLabel } from "./CellShared";
import { ValueCell } from "./ValueCell";

interface PropertyCellProps {
  property: ProtoPropertyInfo;
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  value?: ProtoDataSegment;
  setValue: (data?: ProtoDataSegment) => void;
  pinsKey: string;
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
    // while we could update the selection here as well, I don't think we want a getter to modify our selection
    if (getResult()) props.setValue(getResult()?.result?.data);
  });
  createEffect(() => {
    showError("Set", setResult());
    if (setResult()?.self) props.updateSelection(setResult()!.self!);
  });

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

  const [slot, setSlot] = createSignal<JSX.Element>();

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1">
        <CellTextLabel text={props.property.name} class="grow min-w-0" />
        <CellPinButton
          pinsKey={props.pinsKey}
          pinId={propertyInfoId(props.property)}
        />
        <div class="join w-input-[2rem] max-w-3/5 shrink-0">
          <ValueCell
            class="join-item mono"
            readonly={!props.property.setterId}
            typeInfo={props.property.type!}
            onChange={props.setValue}
            value={props.value}
            setSlot={setSlot}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={arrowPath}
            tooltip="Get value"
            loading={getLoading()}
            onClick={get}
            disabled={!props.property.getterId}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={arrowRightOnRectangle}
            tooltip="Set value"
            loading={setLoading()}
            onClick={set}
            disabled={!props.property.setterId}
          />
        </div>
      </div>
      <Show when={slot()}>
        <div class="floating-menu p-1">{slot()}</div>
      </Show>
    </div>
  );
}
