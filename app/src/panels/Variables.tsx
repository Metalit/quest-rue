import { Icon } from "solid-heroicons";
import {
  arrowTopRightOnSquare,
  barsArrowDown,
  barsArrowUp,
  chevronDoubleRight,
  magnifyingGlass,
  pencil,
  plus,
  xMark,
} from "solid-heroicons/outline";
import { createEffect, createSignal, For, Show } from "solid-js";

import {
  DropdownButton,
  ModeOptions,
  SideDropdownButton,
} from "../components/input/DropdownButton";
import {
  canMakeVariable,
  removeVariable,
  renameVariable,
  Variable,
  variables,
} from "../global/variables";
import { protoTypeToString } from "../types/format";
import { createUpdatingSignal } from "../utils/solid";
import { selectInLastPanel, selectInNewPanel } from "../global/selection";
import { useDockview } from "../dockview/Api";

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

  const api = useDockview();

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
        dropdownPosition="end"
        dropdownClass="flex-row"
      >
        <button class="btn btn-square" onClick={() => removeVariable(name())}>
          <Icon path={xMark} />
        </button>
        <Show when={value().typeInfo?.Info?.$case != "classInfo"}>
          <button class="btn btn-square" disabled>
            <Icon path={pencil} />
          </button>
        </Show>
        <button
          class="btn btn-square"
          onClick={() => selectInNewPanel(api, value())}
        >
          <Icon path={arrowTopRightOnSquare} />
        </button>
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

  return (
    <div class="size-full flex flex-col p-2">
      <div class="flex gap-1">
        <button class="btn btn-square">
          <Icon path={plus} />
        </button>
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
