import { Icon } from "solid-heroicons";
import {
  arrowLongRight,
  barsArrowDown,
  barsArrowUp,
  chevronDoubleRight,
  chevronLeft,
  chevronRight,
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
  JSX,
  onCleanup,
  Show,
} from "solid-js";
import {
  createStore,
  reconcile,
  SetStoreFunction,
  unwrap,
} from "solid-js/store";

import { FieldCell } from "../components/data/FieldCell";
import { MethodCell, MethodCellMemory } from "../components/data/MethodCell";
import { PropertyCell } from "../components/data/PropertyCell";
import {
  DropdownButton,
  FilterOptions,
  ModeOptions,
  SideDropdownButton,
} from "../components/input/DropdownButton";
import { MaxColsGrid } from "../components/MaxColsGrid";
import { useDockview, useDockviewPanel } from "../dockview/Api";
import { getClassDetails } from "../global/cache";
import { sendPacketResult } from "../global/packets";
import {
  backSelection,
  forwardSelection,
  getSelection,
  hasBackSelection,
  hasForwardSelection,
  removePanel,
  selectInLastPanel,
  setLastPanel,
} from "../global/selection";
import { columnCount } from "../global/settings";
import {
  ProtoClassDetails,
  ProtoClassInfo,
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoFieldInfo,
  ProtoMethodInfo,
  ProtoPropertyInfo,
} from "../proto/il2cpp";
import { GetInstanceClassResult, GetInstanceValuesResult } from "../proto/qrue";
import { protoClassToString, protoTypeToString } from "../types/format";
import { bigToString, stringToBig } from "../utils/misc";
import { createAsyncMemo } from "../utils/solid";
import toast from "solid-toast";
import { setDataCase, setTypeCase } from "../types/serialization";

let reloading = false;

type Member = ProtoFieldInfo | ProtoPropertyInfo | ProtoMethodInfo;

type ValuesStore = Record<string, ProtoDataSegment | undefined>;

type MethodsStore = Record<string, MethodCellMemory>;

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

function StyledCellGrid<T>(props: {
  items: T[];
  item: (val: T) => JSX.Element;
}) {
  return (
    <Show when={props.items.length > 0}>
      <MaxColsGrid
        class="p-2 pl-3 gap-y-2 bg-base-50 rounded"
        maxCols={columnCount()}
      >
        <For each={props.items}>{props.item}</For>
      </MaxColsGrid>
    </Show>
  );
}

function DetailsList(props: {
  selection: ProtoDataPayload;
  details: ProtoClassDetails;
  values: ValuesStore;
  setValues: SetStoreFunction<ValuesStore>;
  methodsStore: MethodsStore;
  setMethodsStore: SetStoreFunction<MethodsStore>;
  search: string;
  searchMode: SearchMode;
  filters: FilterMode;
  visibility: VisibilityMode;
  sort: SortMode;
  inverse: boolean;
  first: boolean;
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

  const fieldCell = (field: ProtoFieldInfo) => (
    <FieldCell
      field={field}
      selection={props.selection}
      value={props.values[bigToString(field.id)]}
      setValue={(value) => props.setValues(bigToString(field.id), value)}
    />
  );

  const propertyCell = (property: ProtoPropertyInfo) => (
    <PropertyCell
      property={property}
      selection={props.selection}
      value={props.values[bigToString(property.id)]}
      setValue={(value) => props.setValues(bigToString(property.id), value)}
    />
  );

  const methodCell = (method: ProtoMethodInfo) => (
    <MethodCell
      method={method}
      selection={props.selection}
      memory={props.methodsStore[bigToString(method.id)]}
      setMemory={(...rest: unknown[]) => {
        const key = bigToString(method.id);
        if (key in unwrap(props.methodsStore) || rest.length == 1)
          // @ts-expect-error: store setters are way too complicated
          props.setMethodsStore(key, ...rest);
      }}
    />
  );

  const hasStaticsSection = () =>
    props.visibility == "Static Members Last" &&
    (fieldLists()[1].length > 0 ||
      propertyLists()[1].length > 0 ||
      methodLists()[1].length > 0);

  return (
    <>
      <Show when={!props.first}>
        <span class="ml-1 mt-1 -mb-1 mono">
          {protoClassToString(props.details.clazz!)}
        </span>
      </Show>
      <StyledCellGrid items={fieldLists()[0]} item={fieldCell} />
      <StyledCellGrid items={propertyLists()[0]} item={propertyCell} />
      <StyledCellGrid items={methodLists()[0]} item={methodCell} />
      <Show when={hasStaticsSection()}>
        <div class="divider text-xs text-secondary-content -my-1">
          Static Members
        </div>
      </Show>
      <StyledCellGrid items={fieldLists()[1]} item={fieldCell} />
      <StyledCellGrid items={propertyLists()[1]} item={propertyCell} />
      <StyledCellGrid items={methodLists()[1]} item={methodCell} />
      <Show when={props.details.parent}>
        <DetailsList {...props} details={props.details.parent!} first={false} />
      </Show>
    </>
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
      <Icon class="size-5 -mr-1.5" path={arrowLongRight} />
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

function NoSelection() {
  const [classInput, setClassInput] = createSignal("");
  const [addressInput, setAddressInput] = createSignal("");

  const api = useDockview();

  const validAddress = () => !!addressInput().match(/^0x[0-9a-f]+$/);

  const selectAddress = async () => {
    if (!validAddress()) return;
    const address = stringToBig(addressInput());
    const details = await sendPacketResult<GetInstanceClassResult>({
      getInstanceClass: { address },
    })[0].catch(() => false as const);
    if (!details || !details.classInfo) {
      console.error("invalid address", addressInput());
      toast.error("Invalid address input");
      return;
    }
    selectInLastPanel(api, {
      data: setDataCase({ classData: address }),
      typeInfo: setTypeCase({ classInfo: details.classInfo }),
    });
  };

  return (
    <div class="absolute-centered floating-menu border-shadow flex flex-col gap-2 p-2">
      No Selection
      <div class="join">
        <input
          class="input input-lg join-item"
          placeholder="Select Class"
          use:valueSignal={[classInput, setClassInput]}
        />
        <button
          class="btn btn-lg btn-square join-item"
          onClick={() => console.log(classInput())}
        >
          <Icon path={chevronDoubleRight} />
        </button>
      </div>
      <div class="join">
        <input
          class={`input input-lg join-item ${validAddress() ? "" : "input-error"}`}
          placeholder="Select Address"
          use:valueSignal={[addressInput, setAddressInput]}
          use:onEnter={() => selectAddress()}
        />
        <button class="btn btn-lg btn-square join-item" onClick={selectAddress}>
          <Icon path={chevronDoubleRight} />
        </button>
      </div>
    </div>
  );
}

export function Selection() {
  const { id, active, setTitle } = useDockviewPanel();

  // it should be active, but the api says no until you click on it
  setLastPanel(id);
  createEffect(() => active() && setLastPanel(id));
  onCleanup(() => !reloading && removePanel(id));

  const title = () =>
    getSelection(id)?.typeInfo
      ? protoTypeToString(getSelection(id)!.typeInfo!)
      : "No Selection";
  createEffect(() => setTitle(title()));
  // doesn't update when created for some reason
  requestAnimationFrame(() => setTitle(title()));

  const [details, loading] = createAsyncMemo(async () => {
    const selection = getSelection(id);
    let classInfo: ProtoClassInfo | undefined = undefined;
    if (selection?.typeInfo?.Info?.$case == "classInfo")
      classInfo = selection?.typeInfo.Info.classInfo;
    else if (selection?.typeInfo?.Info?.$case == "structInfo")
      classInfo = selection?.typeInfo.Info.structInfo.clazz;
    if (classInfo) return await getClassDetails(classInfo);
    else return undefined;
  });

  const [values, setValues] = createStore<ValuesStore>({});

  createEffect(
    () =>
      getSelection(id) &&
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

  const [methodsStore, setMethodsStore] = createStore<MethodsStore>({});

  const [search, setSearch] = createSignal("");
  const [searchMode, setSearchMode] = createSignal<SearchMode>(searchModes[0]);
  const [filters, setFilters] = createStore({ ...filterModes });
  const [visibility, setVisibility] = createSignal<VisibilityMode>(
    visibilityModes[2],
  );
  const [sorting, setSorting] = createSignal<SortMode>(sortModes[0]);
  const [inverse, setInverse] = createSignal(false);

  return (
    <Show when={getSelection(id)?.typeInfo} fallback={<NoSelection />}>
      <div class="size-full flex flex-col p-2">
        <div class="flex flex-wrap items-end gap-1 gap-y-1 justify-between">
          <div class="flex gap-1">
            <button
              class="btn btn-square"
              disabled={!hasBackSelection(id)}
              onClick={() => backSelection(id)}
            >
              <Icon path={chevronLeft} />
            </button>
            <button
              class="btn btn-square"
              disabled={!hasForwardSelection(id)}
              onClick={() => forwardSelection(id)}
            >
              <Icon path={chevronRight} />
            </button>
            <DropdownButton
              class="btn-ghost mono text-[16px]"
              text={protoTypeToString(getSelection(id)!.typeInfo!)}
              textFirst
              icon={ellipsisHorizontalCircle}
              disabled={loading()}
              dropdownClass="mono p-2 gap-2 max-w-2xl max-h-96 overflow-auto"
            >
              <InheritancePanel details={details()} />
            </DropdownButton>
          </div>
          <div class="grow max-w-max min-w-0 basis-64 flex gap-1">
            <div class="shrink min-w-0 join">
              <input
                class="join-item input input-exp"
                placeholder="Search"
                use:valueSignal={[search, setSearch]}
              />
              <DropdownButton
                class="join-item"
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
            <SideDropdownButton
              title="Sort Mode"
              icon={inverse() ? barsArrowUp : barsArrowDown}
              dropdownPosition="end"
              mainTitle="Sort Direction"
              onMainClick={() => setInverse((val) => !val)}
            >
              <ModeOptions
                title="Sort Mode"
                modes={sortModes}
                current={sorting()}
                setCurrent={setSorting}
              />
            </SideDropdownButton>
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
          <div class="grow gutter overflow-auto flex flex-col pr-1.5 gap-2">
            <DetailsList
              selection={getSelection(id)!}
              details={details()!}
              values={values}
              setValues={setValues}
              methodsStore={methodsStore}
              setMethodsStore={setMethodsStore}
              search={search()}
              searchMode={searchMode()}
              filters={filters}
              visibility={visibility()}
              sort={sorting()}
              inverse={inverse()}
              first
            />
          </div>
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
