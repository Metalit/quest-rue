import { createSignal, Match, Show, Switch } from "solid-js";

import { Icon } from "solid-heroicons";
import {
  arrowTopRightOnSquare,
  bookmark,
  check,
  chevronDoubleRight,
  plus,
} from "solid-heroicons/outline";
import { useDockview } from "../../dockview/api";
import { selectInLastPanel, selectInNewPanel } from "../../global/selection";
import { createUpdatingParser, extractCase } from "../../global/utils";
import {
  constVariables,
  findVariablesForType,
  isVariableNameFree,
  validVariableName,
} from "../../global/variables";
import {
  ProtoDataSegment,
  ProtoTypeInfo,
  ProtoTypeInfo_Primitive,
} from "../../proto/il2cpp";
import { protoDataToString, protoTypeToString } from "../../types/format";
import { isProtoDataEqual } from "../../types/matching";
import {
  setDataCase,
  stringToDataSegment,
  validString,
} from "../../types/serialization";
import { DropdownButton } from "../input/DropdownButton";
import { SelectInput } from "../input/SelectInput";
import { TypeCell } from "./TypeCell";

const variableCases: (
  | NonNullable<ProtoTypeInfo["Info"]>["$case"]
  | undefined
)[] = ["arrayInfo", "classInfo", "structInfo"];

interface ValueCellProps {
  class?: string;
  typeInfo: ProtoTypeInfo;
  readonly?: boolean;
  title?: string;
  placeholder?: string;
  value?: ProtoDataSegment;
  onChange?: (value: ProtoDataSegment) => void;
}

function VariableActions(props: {
  typeInfo: ProtoTypeInfo;
  value?: ProtoDataSegment;
  readonly?: boolean;
}) {
  const api = useDockview();

  const [nameInput, setNameInput] = createSignal("");

  const validName = () =>
    validVariableName(nameInput()) && isVariableNameFree(nameInput());

  const validValue = () =>
    props.value &&
    !Object.values(constVariables).some(({ data }) =>
      isProtoDataEqual(props.value, data),
    );

  return (
    <DropdownButton
      class="join-item"
      icon={bookmark}
      title="Variable Menu"
      dropdownClass="p-2 gap-2"
      disabled={props.readonly && !validValue()}
    >
      <div class="flex gap-1">
        <button
          class="grow btn"
          disabled={!validValue()}
          onClick={() =>
            selectInLastPanel(api, {
              typeInfo: props.typeInfo,
              data: props.value,
            })
          }
        >
          Select
          <Icon path={chevronDoubleRight} />
        </button>
        <button
          class="btn btn-square"
          disabled={!validValue()}
          onClick={() =>
            selectInNewPanel(api, {
              typeInfo: props.typeInfo,
              data: props.value,
            })
          }
        >
          <Icon path={arrowTopRightOnSquare} />
        </button>
      </div>
      <div class="join">
        <input
          class={`join-item input ${validName() ? "" : "input-error"}`}
          placeholder="Save As"
          disabled={!validValue()}
          use:valueSignal={[nameInput, setNameInput]}
        />
        <button
          class="join-item btn btn-square"
          disabled={!validValue() || !validName()}
        >
          <Icon path={check} />
        </button>
      </div>
      <button class="btn" disabled={props.readonly}>
        Create
        <Icon path={plus} />
      </button>
    </DropdownButton>
  );
}

function FreeInputCell(props: ValueCellProps) {
  const [input, setInput, valid] = createUpdatingParser(
    () => props.value,
    (value) => props.onChange?.(value),
    isProtoDataEqual,
    (value) => protoDataToString(value, props.typeInfo),
    (input) => stringToDataSegment(input, props.typeInfo),
    (input) => validString(input, props.typeInfo),
  );

  return (
    <input
      class={`input ${valid() ? "" : "focus:input-error"} ${props.class ?? ""}`}
      placeholder={props.placeholder}
      title={props.title}
      use:valueSignal={[input, setInput]}
    />
  );
}

function OptionsInputCell(props: ValueCellProps) {
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
      class={`input ${props.class ?? ""}`}
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
  const type = () =>
    props.typeInfo.Info?.$case == "primitiveInfo" &&
    props.typeInfo.Info.primitiveInfo == ProtoTypeInfo_Primitive.TYPE;

  const free = () =>
    props.typeInfo.Info?.$case == "primitiveInfo" &&
    props.typeInfo.Info.primitiveInfo != ProtoTypeInfo_Primitive.TYPE &&
    props.typeInfo.Info.primitiveInfo != ProtoTypeInfo_Primitive.BOOLEAN;

  const typeValue = () => {
    const data = extractCase(props.value?.Data, "primitiveData");
    return data ? ProtoTypeInfo.decode(data) : undefined;
  };

  const setTypeValue = (value: ProtoTypeInfo) =>
    props.onChange?.(
      setDataCase({ primitiveData: ProtoTypeInfo.encode(value).finish() }),
    );

  return (
    <Switch fallback={<OptionsInputCell {...props} />}>
      <Match when={free()}>
        <FreeInputCell {...props} />
      </Match>
      <Match when={type()}>
        <TypeCell
          class={props.class}
          placeholder={props.placeholder}
          title={props.title}
          readonly={props.readonly}
          value={typeValue()}
          onChange={setTypeValue}
        />
      </Match>
    </Switch>
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
    <span class={`w-input join ${props.class ?? ""}`}>
      <VariableActions typeInfo={props.typeInfo} value={props.value} />
      <SelectInput
        class="join-item input"
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
    </span>
  );
}

function OutputOnlyCell(props: ValueCellProps) {
  return (
    <span class={`w-input join ${props.class ?? ""}`}>
      <Show when={variableCases.includes(props.typeInfo.Info?.$case)}>
        <VariableActions
          typeInfo={props.typeInfo}
          value={props.value}
          readonly
        />
      </Show>
      <input
        class="join-item input"
        placeholder={props.placeholder}
        title={props.title}
        value={protoDataToString(props.value, props.typeInfo)}
        readonly
      />
    </span>
  );
}

function ValueCellWithTitle(props: ValueCellProps) {
  return (
    <Show when={!props.readonly} fallback={<OutputOnlyCell {...props} />}>
      <Show
        when={variableCases.includes(props.typeInfo.Info?.$case)}
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
