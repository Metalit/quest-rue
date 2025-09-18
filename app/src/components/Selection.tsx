import { Icon } from "solid-heroicons";
import {
  arrowLongRight,
  barsArrowDown,
  barsArrowUp,
  chevronDoubleRight,
  chevronDown,
  ellipsisHorizontalCircle,
  eye,
  funnel,
  magnifyingGlass,
} from "solid-heroicons/outline";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { getClassDetails } from "../global/cache";
import { getSelection, removePanel, setLastPanel } from "../global/selection";
import { columnCount } from "../global/settings";
import { createAsyncMemo } from "../global/utils";
import {
  ProtoClassDetails,
  ProtoClassInfo,
  ProtoDataPayload,
} from "../proto/il2cpp";
import { protoClassToString, protoTypeToString } from "../types/format";
import { FieldCell } from "./data/FieldCell";
import { MethodCell } from "./data/MethodCell";
import { PropertyCell } from "./data/PropertyCell";
import { PanelProps } from "./Dockview";
import {
  DropdownButton,
  FilterOptions,
  ModeOptions,
} from "./input/DropdownButton";
import { MaxColsGrid } from "./MaxColsGrid";

let reloading = false;

const searchModes = ["Name", "Type", "Parameters"] as const;

type SearchMode = (typeof searchModes)[number];

const filterModes = {
  Fields: true,
  Getters: true,
  Setters: true,
  Methods: true,
};

type FilterMode = typeof filterModes;

const visibilityModes = [
  "Show Static Members",
  "Static Members Only",
  "Static Members Last",
  "Hide Static Members",
] as const;

type VisibilityMode = (typeof visibilityModes)[number];

const sortModes = ["Default", "Name", "Parameters", "Type"] as const;

type SortMode = (typeof sortModes)[number];

function NoSelection() {
  const [classInput, setClassInput] = createSignal("");
  const [addressInput, setAddressInput] = createSignal("");

  return (
    <div class="absolute-centered floating-menu border-shadow flex flex-col gap-2 p-2">
      No Selection
      <div class="join">
        <input
          class="input join-item"
          placeholder="Select Class"
          use:valueSignal={[classInput, setClassInput]}
        />
        <button
          class="btn btn-square join-item"
          onClick={() => console.log(classInput())}
        >
          <Icon path={chevronDoubleRight} />
        </button>
      </div>
      <div class="join">
        <input
          class="input join-item"
          placeholder="Select Address"
          use:valueSignal={[addressInput, setAddressInput]}
        />
        <button class="btn btn-square join-item">
          <Icon path={chevronDoubleRight} />
        </button>
      </div>
    </div>
  );
}

function DetailsList(props: {
  selection: ProtoDataPayload;
  details: ProtoClassDetails;
  search: string;
  searchMode: SearchMode;
  filters: FilterMode;
  visibility: VisibilityMode;
  sort: SortMode;
  inverse: boolean;
}) {
  return (
    <MaxColsGrid class="overflow-auto gap-y-2" maxCols={columnCount()}>
      <For each={props.details.fields}>
        {(field) => <FieldCell field={field} selection={props.selection} />}
      </For>
      <For each={props.details.properties}>
        {(property) => (
          <PropertyCell property={property} selection={props.selection} />
        )}
      </For>
      <For each={props.details.methods}>
        {(method) => <MethodCell method={method} selection={props.selection} />}
      </For>
    </MaxColsGrid>
  );
}

function InheritancePanel(props: { details?: ProtoClassDetails }) {
  const items = () => {
    const list: (ProtoClassInfo | ProtoClassInfo[])[] = [];
    let current = props.details;
    while (current) {
      if (current != props.details) list.push(current.clazz!);
      if (current.interfaces.length > 0) list.push(current.interfaces);
      current = current.parent;
    }
    return list;
  };

  const Interfaces = (props: { items: ProtoClassInfo[] }) => (
    <div class="flex items-center gap-3">
      <Icon class="size-5 mr-[-6px]" path={arrowLongRight} />
      <For each={props.items}>
        {(item) => <span>{protoClassToString(item)}</span>}
      </For>
    </div>
  );

  return (
    <For each={items()}>
      {(item) =>
        Array.isArray(item) ? (
          <Interfaces items={item} />
        ) : (
          <span>{protoClassToString(item)}</span>
        )
      }
    </For>
  );
}

// eslint-disable-next-line solid/no-destructure
export function Selection({ api, id }: PanelProps) {
  setLastPanel(id);
  const dispose = api.onDidActiveChange((e) => e.isActive && setLastPanel(id));
  onCleanup(() => {
    if (!reloading) removePanel(id);
    dispose.dispose();
  });

  const title = () =>
    getSelection(id).typeInfo
      ? protoTypeToString(getSelection(id).typeInfo!)
      : "No Selection";
  createEffect(() => api.setTitle(title()));
  // doesn't update when created for some reason
  requestAnimationFrame(() => api.setTitle(title()));

  const [details, loading] = createAsyncMemo(async () => {
    const selection = getSelection(id);
    let classInfo: ProtoClassInfo | undefined = undefined;
    if (selection.typeInfo?.Info?.$case == "classInfo")
      classInfo = selection.typeInfo.Info.classInfo;
    else if (selection.typeInfo?.Info?.$case == "structInfo")
      classInfo = selection.typeInfo.Info.structInfo.clazz;
    if (classInfo) return await getClassDetails(classInfo);
    else return undefined;
  });

  const [search, setSearch] = createSignal("");
  const [searchMode, setSearchMode] = createSignal<SearchMode>(searchModes[0]);
  const [filters, setFilters] = createStore({ ...filterModes });
  const [visibility, setVisibility] = createSignal<VisibilityMode>(
    visibilityModes[0],
  );
  const [sorting, setSorting] = createSignal<SortMode>(sortModes[0]);
  const [inverse, setInverse] = createSignal(false);

  return (
    <Show when={getSelection(id).typeInfo} fallback={<NoSelection />}>
      <div class="size-full flex flex-col p-2">
        <div class="flex flex-wrap items-end gap-1 gap-y-1">
          <DropdownButton
            class="btn-sm btn-ghost mono text-[16px]"
            text={protoTypeToString(getSelection(id).typeInfo!)}
            icon={ellipsisHorizontalCircle}
            dropdownClass="mono p-2 gap-2 max-w-2xl max-h-96 overflow-auto"
          >
            <InheritancePanel details={details()} />
          </DropdownButton>
          <span class="h-8" />
          <div class="grow basis-0 flex gap-1 items-center justify-end">
            <div class="grow justify-end join">
              <input
                class="join-item input input-sm"
                placeholder="Search"
                use:valueSignal={[search, setSearch]}
              />
              <DropdownButton
                class="join-item btn-sm"
                title="Search Mode"
                icon={magnifyingGlass}
                dropdownPosition="end"
              >
                <ModeOptions
                  title="Search Mode"
                  modes={searchModes}
                  current={searchMode()}
                  setCurrent={setSearchMode}
                />
              </DropdownButton>
            </div>
            <DropdownButton
              class="btn-sm"
              title="Member Filter"
              icon={funnel}
              dropdownPosition="end"
            >
              <FilterOptions
                title="Member Filter"
                filters={filters}
                setFilters={setFilters}
              />
            </DropdownButton>
            <DropdownButton
              class="btn-sm"
              title="Visibility Mode"
              icon={eye}
              dropdownPosition="end"
            >
              <ModeOptions
                title="Visibility Mode"
                modes={visibilityModes}
                current={visibility()}
                setCurrent={setVisibility}
              />
            </DropdownButton>
            <div class="join">
              <button
                class="btn btn-sm btn-square join-item"
                title="Sort Direction"
                onClick={() => setInverse((val) => !val)}
              >
                <Icon path={inverse() ? barsArrowUp : barsArrowDown} />
              </button>
              <DropdownButton
                class="btn-sm w-5 px-1 join-item"
                title="Sort Mode"
                icon={chevronDown}
                dropdownPosition="end"
              >
                <ModeOptions
                  title="Sort Mode"
                  modes={sortModes}
                  current={sorting()}
                  setCurrent={setSorting}
                />
              </DropdownButton>
            </div>
          </div>
        </div>
        <div class="divider" />
        <Show
          when={!loading() && details()}
          fallback={
            <div class="size-full">
              <span class="absolute-centered loading loading-xl" />
            </div>
          }
        >
          <DetailsList
            selection={getSelection(id)}
            details={details()!}
            search={search()}
            searchMode={searchMode()}
            filters={filters}
            visibility={visibility()}
            sort={sorting()}
            inverse={inverse()}
          />
        </Show>
      </div>
    </Show>
  );
}

// prevent loss of selection in hmr
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => (reloading = true));
  import.meta.hot.on("vite:afterUpdate", () => (reloading = false));
}
