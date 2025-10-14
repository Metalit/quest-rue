import { arrowPath } from "solid-heroicons/outline";
import { createEffect, createSignal, JSX, Show } from "solid-js";

import { useRequestAndResponsePacket } from "../../global/packets";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoFieldInfo,
} from "../../proto/il2cpp";
import { GetFieldResult, SetFieldResult } from "../../proto/qrue";
import { isProtoDataEqual } from "../../types/matching";
import { fieldInfoId } from "../../types/serialization";
import { extractCase } from "../../utils/typing";
import { ActionButton } from "../input/ActionButton";
import { CellPinButton, CellTextLabel } from "./CellShared";
import { ValueCell } from "./ValueCell";

interface FieldCellProps {
  field: ProtoFieldInfo;
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  value?: ProtoDataSegment;
  setValue: (data?: ProtoDataSegment) => void;
  pinsKey: string;
}

function setStructField(
  struct: ProtoDataPayload,
  field: ProtoFieldInfo,
  value: ProtoDataSegment,
) {
  const fields =
    extractCase(struct.typeInfo?.Info, "structInfo")?.fieldOffsets ?? {};
  const offset = Object.entries(fields).find(
    ([, { id }]) => id == field.id,
  )?.[0];
  if (offset == undefined) return undefined;
  const copy = ProtoDataSegment.fromPartial(struct.data ?? {});
  if (copy.Data?.$case == "structData")
    copy.Data.structData.data[Number(offset)] = value;
  return copy;
}

export function FieldCell(props: FieldCellProps) {
  const [getResult, getLoading, getValue] =
    useRequestAndResponsePacket<GetFieldResult>();
  const [, setLoading, setValue] =
    useRequestAndResponsePacket<SetFieldResult>();

  createEffect(() => getResult() && props.setValue(getResult()?.value?.data));

  const get = () =>
    getValue({
      getField: {
        fieldId: props.field.id,
        inst: props.selection,
      },
    });

  const set = () => {
    if (props.field.literal || !props.value) return;
    if (
      props.selection.data?.Data?.$case == "structData" &&
      !props.field.readonly
    ) {
      const updated = setStructField(props.selection, props.field, props.value);
      if (updated) props.updateSelection(updated);
    } else
      setValue({
        setField: {
          fieldId: props.field.id,
          inst: props.selection,
          value: { data: props.value, typeInfo: props.field.type },
        },
      });
  };

  // automatically whenever a new valid input is given
  createEffect(
    (prev: ProtoDataSegment | undefined) => {
      if (!isProtoDataEqual(prev, props.value)) set();
      return props.value && ProtoDataSegment.fromPartial(props.value);
    },
    // eslint-disable-next-line solid/reactivity
    props.value && ProtoDataSegment.fromPartial(props.value),
  );

  const [slot, setSlot] = createSignal<JSX.Element>();

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1">
        <CellTextLabel text={props.field.name} class="grow min-w-0" />
        <CellPinButton
          pinsKey={props.pinsKey}
          pinId={fieldInfoId(props.field)}
        />
        <div class="join w-input-[2rem] max-w-3/5 shrink-0">
          <ValueCell
            class="join-item mono"
            typeInfo={props.field.type!}
            onChange={props.setValue}
            value={props.value}
            setSlot={setSlot}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={arrowPath}
            tooltip="Refresh Value"
            loading={getLoading() || setLoading()}
            onClick={get}
          />
        </div>
      </div>
      <Show when={slot()}>
        <div class="floating-menu p-1">{slot()}</div>
      </Show>
    </div>
  );
}
