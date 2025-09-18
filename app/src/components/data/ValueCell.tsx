import { createEffect, createSignal, Show } from "solid-js";

import { findVariablesForType } from "../../global/variables";
import {
  ProtoDataSegment,
  ProtoTypeInfo,
  ProtoTypeInfo_Primitive,
} from "../../proto/il2cpp";
import { protoDataToString, protoTypeToString } from "../../types/format";
import { isProtoDataEqual } from "../../types/matching";
import { stringToDataSegment, validString } from "../../types/serialization";
import { SelectInput } from "../input/SelectInput";

const variableCases: NonNullable<ProtoTypeInfo["Info"]>["$case"][] = [
  "arrayInfo",
  "classInfo",
  "structInfo",
];

interface ValueCellProps {
  class?: string;
  typeInfo: ProtoTypeInfo;
  disableInput?: boolean;
  title?: string;
  placeholder?: string;
  value?: ProtoDataSegment;
  onChange?: (value: ProtoDataSegment) => void;
}

function FreeInputCell(props: ValueCellProps) {
  const [input, setInput] = createSignal("");

  let lastInputData: ProtoDataSegment | undefined = undefined;

  const valid = (input: string) => validString(input, props.typeInfo);

  // each time a new value is input, send it
  createEffect(() => {
    if (!valid(input())) return;
    const inputData = stringToDataSegment(input(), props.typeInfo);
    if (!isProtoDataEqual(inputData, lastInputData)) {
      lastInputData = inputData;
      props.onChange?.(lastInputData);
    }
  });
  // update if the value changed from a source other than the input
  createEffect(() => {
    if (!isProtoDataEqual(lastInputData, props.value)) {
      lastInputData = props.value; // prevent sending it back to props.onChange
      setInput(protoDataToString(props.value, props.typeInfo));
    }
  });
  // the effect logic is to make sure user input doesn't get randomly reformatted

  return (
    <input
      class={`input input-sm ${valid(input()) ? "" : "focus:input-error"} ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      use:valueSignal={[input, setInput]}
    />
  );
}

function OptionsInputCell(props: ValueCellProps) {
  // todo: add type autocomplete (generics and type primitive)
  const options = () => {
    const info = props.typeInfo.Info;
    if (info?.$case == "enumInfo") return Object.keys(info.enumInfo.values);
    if (
      info?.$case == "primitiveInfo" &&
      info.primitiveInfo == ProtoTypeInfo_Primitive.BOOLEAN
    )
      return ["True", "False"];
    return [];
  };

  return (
    <SelectInput
      class={`input input-sm ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      options={options()}
      value={protoDataToString(props.value, props.typeInfo)}
      onChange={(value) =>
        props.onChange?.(stringToDataSegment(value, props.typeInfo))
      }
      search="default"
    />
  );
}

// primitive, generic, or enum
function ManualInputCell(props: ValueCellProps) {
  const free = () =>
    props.typeInfo.Info?.$case == "primitiveInfo" &&
    // props.typeInfo.Info.primitiveInfo != ProtoTypeInfo_Primitive.TYPE &&
    props.typeInfo.Info.primitiveInfo != ProtoTypeInfo_Primitive.BOOLEAN;

  return (
    <Show when={free()} fallback={<OptionsInputCell {...props} />}>
      <FreeInputCell {...props} />
    </Show>
  );
}

// array, struct, or class
function VariableInputCell(props: ValueCellProps) {
  const allowedVariables = () => findVariablesForType(props.typeInfo);

  const match = () =>
    allowedVariables().find(([, { data }]) =>
      isProtoDataEqual(data, props.value),
    ) ?? [undefined, undefined];

  // todo: option to create a new variable
  return (
    <SelectInput
      class={`input input-sm ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      value={match()}
      options={allowedVariables()}
      onChange={([, data]) => data?.data && props.onChange?.(data.data)}
      equals={([name1], [name2]) => name1 == name2}
      search={(input, [name]) =>
        name.toLocaleLowerCase().includes(input.toLocaleLowerCase())
      }
      display={([name]) =>
        name ?? protoDataToString(props.value, props.typeInfo)
      }
    />
  );
}

function OutputOnlyCell(props: ValueCellProps) {
  return (
    <input
      class={`input input-sm ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      value={protoDataToString(props.value, props.typeInfo)}
      readonly
    />
  );
}

function ValueCellWithTitle(props: ValueCellProps) {
  return (
    <Show when={!props.disableInput} fallback={<OutputOnlyCell {...props} />}>
      <Show
        when={variableCases.includes(props.typeInfo.Info!.$case!)}
        fallback={<ManualInputCell {...props} />}
      >
        <VariableInputCell {...props} />
      </Show>
    </Show>
  );
}

export function ValueCell(props: ValueCellProps) {
  const title = () => props.title ?? protoTypeToString(props.typeInfo);
  const placeholder = () => props.placeholder ?? title();
  return (
    <ValueCellWithTitle
      {...props}
      title={title()}
      placeholder={placeholder()}
    />
  );
}
