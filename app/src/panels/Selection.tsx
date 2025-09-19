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
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { createStore, reconcile, SetStoreFunction } from "solid-js/store";

import { FieldCell } from "../components/data/FieldCell";
import { MethodCell } from "../components/data/MethodCell";
import { PropertyCell } from "../components/data/PropertyCell";
import { PanelProps } from "../components/Dockview";
import {
  DropdownButton,
  FilterOptions,
  ModeOptions,
} from "../components/input/DropdownButton";
import { MaxColsGrid } from "../components/MaxColsGrid";
import { getClassDetails } from "../global/cache";
import { sendPacketResult } from "../global/packets";
import { getSelection, removePanel, setLastPanel } from "../global/selection";
import { columnCount } from "../global/settings";
import { bigToString, createAsyncMemo } from "../global/utils";
import {
  ProtoClassDetails,
  ProtoClassInfo,
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoFieldInfo,
  ProtoMethodInfo,
  ProtoPropertyInfo,
} from "../proto/il2cpp";
import { GetInstanceValuesResult } from "../proto/qrue";
import { protoClassToString, protoTypeToString } from "../types/format";

let reloading = false;

type Member = ProtoFieldInfo | ProtoPropertyInfo | ProtoMethodInfo;

type ValuesStore = Record<string, ProtoDataSegment | undefined>;

const searchModes = ["Name", "Type"] as const;

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

function isField(member: Member): member is ProtoFieldInfo {
  const cast = member as ProtoFieldInfo;
  return cast.literal !== undefined;
}

function isProperty(member: Member): member is ProtoPropertyInfo {
  const cast = member as ProtoPropertyInfo;
  return cast.getterId !== undefined || cast.setterId !== undefined;
}

function isMethod(member: Member): member is ProtoMethodInfo {
  const cast = member as ProtoMethodInfo;
  return cast.returnType !== undefined;
}

function memberType(member: Member) {
  return isMethod(member) ? member.returnType! : member.type!;
}

function getSortingField(member: Member, mode: SortMode) {
  switch (mode) {
    case "Default":
      return member.id;
    case "Name":
      return member.name;
    case "Parameters":
      return isMethod(member) ? member.args.length : member.id;
    case "Type":
      return protoTypeToString(memberType(member));
  }
}

function compareMembers(
  member1: Member,
  member2: Member,
  mode: SortMode,
  inverse: boolean,
  fallback: SortMode,
): number {
  const key1 = getSortingField(member1, mode);
  const key2 = getSortingField(member2, mode);
  let ret = 0;
  if (typeof key1 == "bigint") ret = Number(key1 - (key2 as bigint));
  else if (typeof key1 == "string") ret = key1.localeCompare(key2 as string);
  if (ret == 0 && mode != fallback)
    return compareMembers(member1, member2, fallback, inverse, fallback);
  return inverse ? ret * -1 : ret;
}

function filterMembers<T extends Member>(
  members: T[],
  statics: T[],
  search: string,
  searchMode: SearchMode,
  filters: FilterMode,
  visibility: VisibilityMode,
  sort: SortMode,
  inverse: boolean,
): [T[], T[]] {
  let first: T;
  if (members.length != 0) first = members[0];
  else if (statics.length != 0) first = statics[0];
  else return [[], []];
  if (
    (isField(first) && !filters.Fields) ||
    (isMethod(first) && !filters.Methods)
  )
    return [[], []];

  let list1: T[] = [];
  let list2: T[] = [];
  switch (visibility) {
    case "Show Static Members":
      list1 = [...members, ...statics];
      break;
    case "Hide Static Members":
      list1 = members;
      break;
    case "Static Members Last":
      list1 = members;
      list2 = statics;
      break;
    case "Static Members Only":
      list1 = statics;
      break;
  }
  search = search.toLocaleLowerCase();
  return [list1, list2].map((list) =>
    list
      .filter(
        (member) =>
          !isProperty(member) ||
          (member.getterId && filters.Getters) ||
          (member.setterId && filters.Setters),
      )
      .filter((member) =>
        (searchMode == "Name"
          ? member.name
          : protoTypeToString(memberType(member))
        )
          .toLocaleLowerCase()
          .includes(search),
      )
      .sort((member1, member2) =>
        compareMembers(member1, member2, sort, inverse, "Default"),
      ),
  ) as [T[], T[]];
}

function DetailsList(props: {
  selection: ProtoDataPayload;
  details: ProtoClassDetails;
  values: ValuesStore;
  setValues: SetStoreFunction<ValuesStore>;
  search: string;
  searchMode: SearchMode;
  filters: FilterMode;
  visibility: VisibilityMode;
  sort: SortMode;
  inverse: boolean;
}) {
  const fieldLists = createMemo(() =>
    filterMembers(
      props.details.fields,
      props.details.staticFields,
      props.search,
      props.searchMode,
      props.filters,
      props.visibility,
      props.sort,
      props.inverse,
    ),
  );

  const propertyLists = createMemo(() =>
    filterMembers(
      props.details.properties,
      props.details.staticProperties,
      props.search,
      props.searchMode,
      props.filters,
      props.visibility,
      props.sort,
      props.inverse,
    ),
  );

  const methodLists = createMemo(() =>
    filterMembers(
      props.details.methods,
      props.details.staticMethods,
      props.search,
      props.searchMode,
      props.filters,
      props.visibility,
      props.sort,
      props.inverse,
    ),
  );

  return (
    <MaxColsGrid class="overflow-auto gap-y-2" maxCols={columnCount()}>
      <For each={fieldLists()[0]}>
        {(field) => (
          <FieldCell
            field={field}
            selection={props.selection}
            value={props.values[bigToString(field.id)]}
            setValue={(value) => props.setValues(bigToString(field.id), value)}
          />
        )}
      </For>
      <For each={propertyLists()[0]}>
        {(property) => (
          <PropertyCell
            property={property}
            selection={props.selection}
            value={props.values[bigToString(property.id)]}
            setValue={(value) =>
              props.setValues(bigToString(property.id), value)
            }
          />
        )}
      </For>
      <For each={methodLists()[0]}>
        {(method) => (
          <MethodCell
            method={method}
            selection={props.selection}
            rememberedReturn={props.values[bigToString(method.id)]}
            setReturn={(value) =>
              props.setValues(bigToString(method.id), value)
            }
          />
        )}
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

  const [values, setValues] = createStore<ValuesStore>({});

  createEffect(() =>
    sendPacketResult<GetInstanceValuesResult>({
      getInstanceValues: { instance: getSelection(id) },
    })[0].then((result) =>
      setValues(
        reconcile(
          Object.fromEntries(
            result.values.map(({ id, data }) => [bigToString(id), data]),
          ),
        ),
      ),
    ),
  );

  const [search, setSearch] = createSignal("");
  const [searchMode, setSearchMode] = createSignal<SearchMode>(searchModes[0]);
  const [filters, setFilters] = createStore({ ...filterModes });
  const [visibility, setVisibility] = createSignal<VisibilityMode>(
    visibilityModes[2],
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
            values={values}
            setValues={setValues}
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
