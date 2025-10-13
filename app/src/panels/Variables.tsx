import { Icon } from "solid-heroicons";
import {
  arrowTopRightOnSquare,
  barsArrowDown,
  barsArrowUp,
  check,
  chevronDoubleRight,
  magnifyingGlass,
  pencil,
  plus,
  square_2Stack,
  xMark,
} from "solid-heroicons/outline";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { Creation } from "../components/Creation";
import { fillTypeInfo, TypeCell } from "../components/data/TypeCell";
import {
  DropdownButton,
  ModeOptions,
  SideDropdownButton,
} from "../components/input/DropdownButton";
import { SelectInput } from "../components/input/SelectInput";
import { useDockview } from "../dockview/Api";
import { selectInLastPanel, selectInNewPanel } from "../global/selection";
import {
  canMakeVariable,
  copyVariable,
  createScopedVariable,
  removeVariable,
  renameVariable,
  Variable,
  variables,
} from "../global/variables";
import { ProtoTypeInfo } from "../proto/il2cpp";
import { protoTypeToString } from "../types/format";
import { createTrigger, createUpdatingSignal } from "../utils/solid";
import { openFloatingByClick } from "../utils/misc";

const searchModes = ["Name", "Type"] as const;

type SearchMode = (typeof searchModes)[number];

const sortModes = ["Recent", "Name", "Type"] as const;

type SortMode = (typeof sortModes)[number];

function getSortingField(variable: Variable, idx: number, mode: SortMode) {
  switch (mode) {
    case "Recent":
      return -idx;
    case "Name":
      return variable.name;
    case "Type":
      return protoTypeToString(variable.value.typeInfo);
  }
}

function compareVariables(
  var1: Variable,
  i1: number,
  var2: Variable,
  i2: number,
  mode: SortMode,
  inverse: boolean,
  fallback: SortMode,
) {
  const key1 = getSortingField(var1, i1, mode);
  const key2 = getSortingField(var2, i2, mode);
  let ret = 0;
  if (typeof key1 == "number") ret = key1 - (key2 as number);
  else if (typeof key1 == "string") ret = key1.localeCompare(key2 as string);
  if (ret == 0 && mode != fallback)
    return compareVariables(var1, i1, var2, i2, fallback, inverse, fallback);
  return inverse ? ret * -1 : ret;
}

function filterVariables(
  search: string,
  searchMode: SearchMode,
  sorting: SortMode,
  inverse: boolean,
) {
  search = search.toLocaleLowerCase();

  return variables
    .map((v, i) => [v, i] as const)
    .filter(([{ name, value }]) =>
      (searchMode == "Name" ? name : protoTypeToString(value.typeInfo))
        .toLocaleLowerCase()
        .includes(search),
    )
    .sort((var1, var2) =>
      compareVariables(
        var1[0],
        var1[1],
        var2[0],
        var2[1],
        sorting,
        inverse,
        "Recent",
      ),
    )
    .map(([, i]) => i);
}

function VariableCell(props: { index: number }) {
  const name = () => variables[props.index].name;
  const value = () => variables[props.index].value;

  const [input, setInput] = createUpdatingSignal(name);
  createEffect(() => renameVariable(name(), input()));

  const validInput = () => input() == name() || canMakeVariable(input());
  const canSelect = () => value().typeInfo?.Info?.$case != "arrayInfo";
  const canEdit = () => value().typeInfo?.Info?.$case != "classInfo";

  const api = useDockview();

  const hide = createTrigger();

  return (
    <div class="join">
      <input
        class={`join-item input ${validInput() ? "" : "input-error"}`}
        placeholder="Name"
        title={protoTypeToString(value().typeInfo)}
        use:valueSignal={[input, setInput]}
        onBlur={() => setInput(name())}
      />
      <SideDropdownButton
        class="join-item"
        icon={chevronDoubleRight}
        mainTitle="Select"
        onMainClick={() => selectInLastPanel(api, value())}
        mainDisabled={!canSelect()}
        dropdownPosition="end"
        dropdownClass="flex-row"
        hideTrigger={hide}
      >
        <button class="btn btn-square" onClick={() => removeVariable(name())}>
          <Icon path={xMark} />
        </button>
        <Show when={canEdit()}>
          <button
            class="btn btn-square"
            onClick={(e) => {
              hide.trigger();
              openFloatingByClick(e, api, "editor", {
                init: variables[props.index].id,
              });
            }}
          >
            <Icon path={pencil} />
          </button>
        </Show>
        <Show when={canSelect()}>
          <button
            class="btn btn-square"
            onClick={() => selectInNewPanel(api, value())}
          >
            <Icon path={arrowTopRightOnSquare} />
          </button>
        </Show>
      </SideDropdownButton>
    </div>
  );
}

function VariableList(props: {
  search: string;
  searchMode: SearchMode;
  sorting: SortMode;
  inverse: boolean;
}) {
  const filteredVariables = () =>
    filterVariables(
      props.search,
      props.searchMode,
      props.sorting,
      props.inverse,
    );

  return (
    <div class="flex flex-col gap-2">
      <For each={filteredVariables()}>{(i) => <VariableCell index={i} />}</For>
    </div>
  );
}

export function Variables() {
  const [search, setSearch] = createSignal("");
  const [searchMode, setSearchMode] = createSignal<SearchMode>(searchModes[0]);
  const [sorting, setSorting] = createSignal<SortMode>(sortModes[0]);
  const [inverse, setInverse] = createSignal(false);

  const [copyName, setCopyName] = createSignal("");
  const [typeInput, setTypeInput] = createSignal<ProtoTypeInfo>();
  const [name, setName] = createSignal("");
  const [creating, setCreating] = createSignal<ProtoTypeInfo>();

  const variable = createMemo(
    () => creating() && createScopedVariable(creating()!),
  );

  const hide = createTrigger();

  return (
    <div class="size-full flex flex-col p-2">
      <div class="flex gap-1">
        <DropdownButton
          icon={plus}
          title="Create object"
          hideTrigger={hide}
          dropdownClass="w-64"
        >
          <div class="join">
            <SelectInput
              class={`join-item input ${copyName() ? "" : "input-error"}`}
              placeholder="Copy variable"
              title="Copy variable"
              value={copyName()}
              options={variables.map(({ name }) => name)}
              onChange={setCopyName}
              search="default"
              disabled={variables.length == 0}
            />
            <button
              class="join-item btn btn-square"
              title="Copy"
              onClick={() => {
                hide.trigger();
                copyVariable(copyName());
              }}
              disabled={!copyName()}
            >
              <Icon path={square_2Stack} />
            </button>
          </div>
          <div class="join">
            <TypeCell
              class="join-item"
              placeholder="Variable type"
              title="Variable type"
              value={typeInput()}
              onChange={setTypeInput}
              filter={(type) =>
                ["classInfo", "structInfo", "arrayInfo"].includes(
                  type.Info?.$case ?? "",
                )
              }
            />
            <button
              class="join-item btn btn-square"
              title="Use type"
              onClick={() => {
                hide.trigger();
                fillTypeInfo(typeInput()).then(setCreating);
              }}
              disabled={!typeInput()}
            >
              <Icon path={check} />
            </button>
          </div>
        </DropdownButton>
        <div class="grow join max-w-max min-w-0">
          <input
            class="join-item input input-exp"
            placeholder="Search"
            use:valueSignal={[search, setSearch]}
          />
          <DropdownButton
            class="join-item"
            icon={magnifyingGlass}
            title="Search Mode"
            dropdownPosition="end"
          >
            <ModeOptions
              current={searchMode()}
              setCurrent={setSearchMode}
              title="Search Mode"
              modes={searchModes}
            />
          </DropdownButton>
        </div>
        <SideDropdownButton
          class="join-item"
          icon={inverse() ? barsArrowUp : barsArrowDown}
          title="Search Mode"
          dropdownPosition="end"
          mainTitle="Sort Direction"
          onMainClick={() => setInverse((val) => !val)}
        >
          <ModeOptions
            current={sorting()}
            setCurrent={setSorting}
            title="Sort Mode"
            modes={sortModes}
          />
        </SideDropdownButton>
      </div>
      <Show when={creating()}>
        <div class="rounded bg-base-50 -mx-0.5 mt-1.5 p-1.5 flex flex-col gap-2">
          <input
            class="input shrink-0"
            placeholder="Name"
            title="Name"
            use:valueSignal={[name, setName]}
          />
          <Creation
            typeInfo={creating()!}
            variable={variable()!}
            cancel={() => setCreating(undefined)}
            confirm={() => {
              variable()!
                .save(name())
                .then(() => setCreating(undefined));
            }}
          />
        </div>
      </Show>
      <div class="divider" />
      <VariableList
        search={search()}
        searchMode={searchMode()}
        sorting={sorting()}
        inverse={inverse()}
      />
    </div>
  );
}
