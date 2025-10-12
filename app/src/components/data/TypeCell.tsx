import { createEffect } from "solid-js";

import {
  sendPacketResult,
  useRequestAndResponsePacket,
} from "../../global/packets";
import { ProtoClassInfo, ProtoTypeInfo } from "../../proto/il2cpp";
import {
  FillTypeInfoResult,
  GetTypeComplete,
  GetTypeCompleteResult,
} from "../../proto/qrue";
import { protoTypeToString, stringToProtoType } from "../../types/format";
import { areProtoTypesEqual } from "../../types/matching";
import { setTypeCase } from "../../types/serialization";
import { createUpdatingParser } from "../../utils/solid";
import { SelectInput } from "../input/SelectInput";

interface TypeCellProps {
  class?: string;
  readonly?: boolean;
  title?: string;
  placeholder?: string;
  value?: ProtoTypeInfo;
  onChange?: (value: ProtoTypeInfo) => void;
  filter?: (value: ProtoTypeInfo) => boolean;
}

function parsePartialInput(input: string): GetTypeComplete {
  const words = input.split(/\s/);
  const lastWord = words[words.length - 1];
  if (lastWord == "") return {};
  const split = lastWord.split("::");
  if (split.length == 1) return { clazz: lastWord };
  else if (split.length == 2)
    return {
      namespaze: split[split.length - 2],
      clazz: split[split.length - 1],
    };
  else return {};
}

export async function fillTypeInfo(
  typeInfo?: ProtoTypeInfo,
): Promise<ProtoTypeInfo | undefined> {
  const getInfo = async (clazz?: ProtoClassInfo) =>
    (await sendPacketResult<FillTypeInfoResult>({ fillTypeInfo: { clazz } })[0])
      .info;

  switch (typeInfo?.Info?.$case) {
    case "primitiveInfo":
    case "genericInfo":
      return typeInfo;
    case "enumInfo":
      return getInfo(typeInfo.Info.enumInfo.clazz);
    case "classInfo":
      return getInfo(typeInfo.Info.classInfo);
    case "structInfo":
      return getInfo(typeInfo.Info.structInfo.clazz);
    case "arrayInfo": {
      if (!typeInfo.Info.arrayInfo.memberType) return undefined;
      const memberType = await fillTypeInfo(typeInfo.Info.arrayInfo.memberType);
      return setTypeCase({ arrayInfo: { memberType } });
    }
  }
  return undefined;
}

export function TypeCell(props: TypeCellProps) {
  const [input, setInput, valid, clear] = createUpdatingParser(
    () => props.value,
    (value) => props.onChange?.(value),
    areProtoTypesEqual,
    protoTypeToString,
    (input) => stringToProtoType(input)!,
    (input) =>
      !!stringToProtoType(input) &&
      (!props.filter || props.filter(stringToProtoType(input)!)),
  );

  const [completions, , searchTypes] =
    useRequestAndResponsePacket<GetTypeCompleteResult>(true);

  const options = () =>
    (completions()?.options ?? [])
      .sort((s1, s2) => s1.length - s2.length)
      .slice(0, 50);

  createEffect(() =>
    searchTypes({ getTypeComplete: parsePartialInput(input()) }),
  );

  return (
    <SelectInput
      class={`input ${valid() ? "" : "input-error"} ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      free
      value={input()}
      onInput={setInput}
      options={options()}
      onBlur={clear}
    />
  );
}
