import { Icon } from "solid-heroicons";
import {
  barsArrowDown,
  barsArrowUp,
  chevronDoubleRight,
  chevronDown,
  eye,
  funnel,
  magnifyingGlass,
} from "solid-heroicons/outline";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

import { createStore } from "solid-js/store";
import { useRequestAndResponsePacket } from "../global/packets";
import { getSelection, removePanel, setLastPanel } from "../global/selection";
import { ProtoClassDetails, ProtoClassInfo } from "../proto/il2cpp";
import { GetClassDetailsResult } from "../proto/qrue";
import { protoTypeToString } from "../types/format";
import { PanelProps } from "./Dockview";
import {
  DropdownButton,
  FilterOptions,
  ModeOptions,
} from "./input/DropdownButton";

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
  details: ProtoClassDetails;
  search: string;
  searchMode: SearchMode;
  filters: FilterMode;
  visibility: VisibilityMode;
  sort: SortMode;
  inverse: boolean;
}) {
  return (
    <div class="overflow-auto flex flex-col">
      <For each={props.details.methods}>
        {(method) => <div>{method.name}</div>}
      </For>
    </div>
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

  const [details, detailsLoading, getDetails] =
    useRequestAndResponsePacket<GetClassDetailsResult>(true);

  createEffect(() => {
    const selection = getSelection(id);
    let classInfo: ProtoClassInfo | undefined = undefined;
    if (selection.typeInfo?.Info?.$case == "classInfo")
      classInfo = selection.typeInfo.Info.classInfo;
    else if (selection.typeInfo?.Info?.$case == "structInfo")
      classInfo = selection.typeInfo.Info.structInfo.clazz;
    if (classInfo) getDetails({ getClassDetails: { classInfo } });
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
      <div class="w-full h-full flex flex-col p-2">
        <div class="flex flex-wrap gap-3 gap-y-1">
          <span class="mono h-8 content-end">
            {protoTypeToString(getSelection(id).typeInfo!)}
          </span>
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
          when={!detailsLoading() && details()?.classDetails}
          fallback={
            <div class="w-full h-full">
              <span class="absolute-centered loading loading-xl" />
            </div>
          }
        >
          <DetailsList
            details={details()!.classDetails!}
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
