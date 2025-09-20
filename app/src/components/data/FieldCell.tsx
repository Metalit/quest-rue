import { arrowPath } from "solid-heroicons/outline";
import { createEffect } from "solid-js";

import { useRequestAndResponsePacket } from "../../global/packets";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoFieldInfo,
} from "../../proto/il2cpp";
import { GetFieldResult, SetFieldResult } from "../../proto/qrue";
import { ActionButton } from "../input/ActionButton";
import { ValueCell } from "./ValueCell";

interface FieldCellProps {
  field: ProtoFieldInfo;
  selection: ProtoDataPayload;
  value?: ProtoDataSegment;
  setValue: (data?: ProtoDataSegment) => void;
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

  const set = () =>
    !props.field.literal &&
    props.value &&
    setValue({
      setField: {
        fieldId: props.field.id,
        inst: props.selection,
        value: { data: props.value, typeInfo: props.field.type },
      },
    });

  // automatically whenever a valid input is given
  createEffect(set);

  return (
    <div class="flex items-center justify-between">
      <span class="mono grow min-w-0" title={props.field.name}>
        {props.field.name}
      </span>
      <div class="join w-3/5 shrink-0 justify-end">
        <ValueCell
          class="join-item mono"
          typeInfo={props.field.type!}
          onChange={props.setValue}
          value={props.value}
        />
        <ActionButton
          class="join-item btn btn-sm btn-square"
          img={arrowPath}
          tooltip="Refresh Value"
          loading={getLoading() || setLoading()}
          onClick={get}
        />
      </div>
    </div>
  );
}
