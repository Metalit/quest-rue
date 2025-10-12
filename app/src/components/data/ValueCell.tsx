import { Icon } from "solid-heroicons";
import {
  arrowTopRightOnSquare,
  bookmark,
  check,
  chevronDoubleRight,
  pencil,
  plus,
} from "solid-heroicons/outline";
import { createMemo, createSignal, JSX, Match, Show, Switch } from "solid-js";

import { useDockview } from "../../dockview/Api";
import { selectInLastPanel, selectInNewPanel } from "../../global/selection";
import {
  addVariable,
  canMakeVariable,
  constVariables,
  createScopedVariable,
  findVariablesForType,
  variables,
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
import {
  createLazyMemo,
  createTrigger,
  createUpdatingParser,
} from "../../utils/solid";
import { extractCase } from "../../utils/typing";
import { Creation } from "../Creation";
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
  setSlot?: (element: JSX.Element) => void;
}

function VariableActions(props: {
  typeInfo: ProtoTypeInfo;
  value?: ProtoDataSegment;
  onChange?: (value: ProtoDataSegment) => void;
  slot?: (element: JSX.Element) => void;
  readonly?: boolean;
}) {
  const api = useDockview();

  const [nameInput, setNameInput] = createSignal("");

  const validName = () => canMakeVariable(nameInput());

  const validValue = () =>
    props.value &&
    !constVariables.some(([, { data }]) => isProtoDataEqual(props.value, data));

  const canSelect = () =>
    validValue() && props.typeInfo.Info?.$case != "arrayInfo";

  const saveVariable = () =>
    validValue() &&
    validName() &&
    addVariable(nameInput(), { data: props.value, typeInfo: props.typeInfo });

  const hide = createTrigger();

  const tempVar = createMemo(() => createScopedVariable(props.typeInfo));
  const localVar = createMemo(() => createScopedVariable(props.typeInfo));

  const creation = createLazyMemo(() => (
    <Creation
      typeInfo={props.typeInfo}
      variable={tempVar()}
      cancel={() => props.slot?.(undefined)}
      confirm={() => {
        const value = tempVar().get();
        if (value) props.onChange?.(value);
        tempVar().transfer(localVar(), true);
        props.slot?.(undefined);
      }}
    />
  ));

  return (
    <DropdownButton
      class="join-item"
      icon={bookmark}
      title="Variable Menu"
      dropdownClass="p-2 gap-2"
      disabled={props.readonly && !validValue()}
      hideTrigger={hide}
    >
      <div class="flex gap-1">
        <button
          class="grow btn"
          title="Select"
          disabled={!canSelect()}
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
          title="Select in new panel"
          disabled={!canSelect()}
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
      <div class="flex gap-1">
        <button
          class="grow btn"
          title="Create object"
          onClick={() => {
            hide.trigger();
            props.slot?.(creation());
          }}
          disabled={props.readonly}
        >
          Create
          <Icon path={plus} />
        </button>
        <Show when={props.typeInfo.Info?.$case != "classInfo"}>
          <button class="btn btn-square" title="Edit" disabled>
            <Icon path={pencil} />
          </button>
        </Show>
      </div>
      <div class="join">
        <input
          class={`join-item input ${validName() ? "" : "input-error"}`}
          placeholder="Save As"
          disabled={!validValue()}
          use:valueSignal={[nameInput, setNameInput]}
          use:onEnter={() => saveVariable()}
        />
        <button
          class="join-item btn btn-square"
          title="Save variable"
          disabled={!validValue() || !validName()}
          onClick={saveVariable}
        >
          <Icon path={check} />
        </button>
      </div>
    </DropdownButton>
  );
}

function FreeInputCell(props: ValueCellProps) {
  const [input, setInput, valid] = createUpdatingParser(
    () => props.value,
    (value) => props.onChange?.(value),
    isProtoDataEqual,
    (value) => protoDataToString(value, props.typeInfo),
    (input) => stringToDataSegment(input, props.typeInfo)!,
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
        props.onChange?.(stringToDataSegment(value, props.typeInfo)!)
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
    allowedVariables().find(({ value: { data } }) =>
      isProtoDataEqual(data, props.value),
    );

  // todo: option to create a new variable
  return (
    <span class={`w-input join ${props.class ?? ""}`}>
      <VariableActions
        typeInfo={props.typeInfo}
        value={props.value}
        onChange={props.onChange}
        slot={props.setSlot}
      />
      <SelectInput
        class="join-item input"
        placeholder={props.placeholder}
        title={props.title}
        value={match()}
        options={allowedVariables()}
        onChange={(variable) =>
          variable?.value?.data && props.onChange?.(variable?.value?.data)
        }
        search={(input, { name }) =>
          name.toLocaleLowerCase().includes(input.toLocaleLowerCase())
        }
        display={(variable) =>
          variable?.name ?? protoDataToString(props.value, props.typeInfo)
        }
      />
    </span>
  );
}

function OutputOnlyCell(props: ValueCellProps) {
  const match = () =>
    variables.find(({ value: { data } }) =>
      isProtoDataEqual(data, props.value),
    );

  return (
    <span class={`w-input join ${props.class ?? ""}`}>
      <Show when={variableCases.includes(props.typeInfo.Info?.$case)}>
        <VariableActions
          typeInfo={props.typeInfo}
          value={props.value}
          onChange={props.onChange}
          slot={props.setSlot}
          readonly
        />
      </Show>
      <input
        class="join-item input"
        placeholder={props.placeholder}
        title={props.title}
        value={match()?.name ?? protoDataToString(props.value, props.typeInfo)}
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
