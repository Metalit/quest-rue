import { createEffect } from "solid-js";

import { useRequestAndResponsePacket } from "../../global/packets";
import { createUpdatingParser } from "../../global/utils";
import { ProtoTypeInfo } from "../../proto/il2cpp";
import { GetTypeComplete, GetTypeCompleteResult } from "../../proto/qrue";
import { protoTypeToString, stringToProtoType } from "../../types/format";
import { areProtoTypesEqual } from "../../types/matching";
import { SelectInput } from "../input/SelectInput";

interface TypeCellProps {
  class?: string;
  readonly?: boolean;
  title?: string;
  placeholder?: string;
  value?: ProtoTypeInfo;
  onChange?: (value: ProtoTypeInfo) => void;
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

export function TypeCell(props: TypeCellProps) {
  const [input, setInput, valid] = createUpdatingParser(
    () => props.value,
    (value) => props.onChange?.(value),
    areProtoTypesEqual,
    protoTypeToString,
    (input) => stringToProtoType(input)!,
    (input) => !!stringToProtoType(input),
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
      class={`input ${valid() ? "" : "focus-within:input-error"} ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      free
      value={input()}
      onInput={setInput}
      options={options()}
    />
  );
}
