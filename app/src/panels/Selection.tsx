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
  batch,
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
import toast from "solid-toast";

import { FieldCell } from "../components/data/FieldCell";
import { MethodCell, MethodCellState } from "../components/data/MethodCell";
import { PropertyCell } from "../components/data/PropertyCell";
import { TypeCell } from "../components/data/TypeCell";
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
  updateSelection,
} from "../global/selection";
import { columnCount, memberPins } from "../global/settings";
import {
  ProtoClassDetails,
  ProtoClassInfo,
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoFieldInfo,
  ProtoMethodInfo,
  ProtoPropertyInfo,
  ProtoTypeInfo,
} from "../proto/il2cpp";
import { GetInstanceClassResult, GetInstanceValuesResult } from "../proto/qrue";
import { protoClassToString, protoTypeToString } from "../types/format";
import {
  fieldInfoId,
  methodInfoId,
  propertyInfoId,
  setDataCase,
  setTypeCase,
} from "../types/serialization";
import { bigToString, stringToBig } from "../utils/misc";
import { createAsyncMemo } from "../utils/solid";

let reloading = false;

type Member = ProtoFieldInfo | ProtoPropertyInfo | ProtoMethodInfo;

type ValuesStore = Record<string, ProtoDataSegment | undefined>;

type MethodsStore = Record<string, MethodCellState>;

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

type ListPair<T> = [T[], T[]];

function filterMembers<T extends Member>(
  members: T[],
  statics: T[],
  search: string,
  searchMode: SearchMode,
  filters: FilterMode,
  visibility: VisibilityMode,
  sort: SortMode,
  inverse: boolean,
): ListPair<T> {
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
  ) as ListPair<T>;
}

function filterPins<T extends Member>(
  members: T[],
  statics: T[],
  pins: string[],
  memberToId: (member: T) => string,
): ListPair<T> {
  // keep pins sorted
  return [members, statics].map((list) =>
    pins
      .map((id) => list.find((member) => memberToId(member) == id))
      .filter((value) => value != undefined),
  ) as ListPair<T>;
}

function hasPins(details?: ProtoClassDetails): boolean {
  return (
    !!details &&
    ((memberPins[protoClassToString(details.clazz!, true)] ?? []).some(
      (id) =>
        details.fields.some((field) => fieldInfoId(field) == id) ||
        details.staticFields.some((field) => fieldInfoId(field) == id) ||
        details.properties.some((prop) => propertyInfoId(prop) == id) ||
        details.staticProperties.some((prop) => propertyInfoId(prop) == id) ||
        details.methods.some((method) => methodInfoId(method) == id) ||
        details.staticMethods.some((method) => methodInfoId(method) == id),
    ) ||
      hasPins(details.parent))
  );
}

function StyledCellGrid<T>(props: {
  items: T[];
  item: (val: T) => JSX.Element;
}) {
  return (
    <Show when={props.items.length > 0}>
      <MaxColsGrid
        class="p-2 gap-y-2 bg-base-50 rounded"
        maxCols={columnCount()}
      >
        <For each={props.items}>{props.item}</For>
      </MaxColsGrid>
    </Show>
  );
}

function GroupedMembersList(props: {
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  details: ProtoClassDetails;
  values: ValuesStore;
  setValues: SetStoreFunction<ValuesStore>;
  methodsStore: MethodsStore;
  setMethodsStore: SetStoreFunction<MethodsStore>;
  fieldLists: ListPair<ProtoFieldInfo>;
  propertyLists: ListPair<ProtoPropertyInfo>;
  methodLists: ListPair<ProtoMethodInfo>;
  header?: string;
  staticsHeader?: boolean;
}) {
  const pinsKey = () => protoClassToString(props.details.clazz!, true);

  const fieldCell = (field: ProtoFieldInfo) => (
    <FieldCell
      field={field}
      selection={props.selection}
      updateSelection={props.updateSelection}
      value={props.values[bigToString(field.id)]}
      setValue={(value) => props.setValues(bigToString(field.id), value)}
      pinsKey={pinsKey()}
    />
  );

  const propertyCell = (property: ProtoPropertyInfo) => (
    <PropertyCell
      property={property}
      selection={props.selection}
      updateSelection={props.updateSelection}
      value={props.values[bigToString(property.id)]}
      setValue={(value) => props.setValues(bigToString(property.id), value)}
      pinsKey={pinsKey()}
    />
  );

  const methodCell = (method: ProtoMethodInfo) => (
    <MethodCell
      method={method}
      selection={props.selection}
      updateSelection={props.updateSelection}
      state={props.methodsStore[bigToString(method.id)] ?? {}}
      setState={(...rest: unknown[]) => {
        const key = bigToString(method.id);
        batch(() => {
          if (!(key in unwrap(props.methodsStore)) && rest.length > 1)
            props.setMethodsStore(key, {});
          // @ts-expect-error: store setters are way too complicated
          props.setMethodsStore(key, ...rest);
        });
      }}
      pinsKey={pinsKey()}
    />
  );

  const showStaticsHeader = () =>
    props.staticsHeader &&
    (props.fieldLists[1].length > 0 ||
      props.propertyLists[1].length > 0 ||
      props.methodLists[1].length > 0);

  return (
    <>
      <Show when={props.header != undefined}>
        <span class="ml-1 mt-1 -mb-1 mono">{props.header}</span>
      </Show>
      <StyledCellGrid items={props.fieldLists[0]} item={fieldCell} />
      <StyledCellGrid items={props.propertyLists[0]} item={propertyCell} />
      <StyledCellGrid items={props.methodLists[0]} item={methodCell} />
      <Show when={showStaticsHeader()}>
        <div class="divider text-xs text-secondary-content -my-1">
          Static Members
        </div>
      </Show>
      <StyledCellGrid items={props.fieldLists[1]} item={fieldCell} />
      <StyledCellGrid items={props.propertyLists[1]} item={propertyCell} />
      <StyledCellGrid items={props.methodLists[1]} item={methodCell} />
    </>
  );
}

function PinsList(props: {
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  details: ProtoClassDetails;
  values: ValuesStore;
  setValues: SetStoreFunction<ValuesStore>;
  methodsStore: MethodsStore;
  setMethodsStore: SetStoreFunction<MethodsStore>;
}) {
  const pins = () =>
    memberPins[protoClassToString(props.details.clazz!, true)] ?? [];

  const fieldLists = createMemo(() =>
    filterPins(
      props.details.fields,
      props.details.staticFields,
      pins(),
      fieldInfoId,
    ),
  );

  const propertyLists = createMemo(() =>
    filterPins(
      props.details.properties,
      props.details.staticProperties,
      pins(),
      propertyInfoId,
    ),
  );

  const methodLists = createMemo(() =>
    filterPins(
      props.details.methods,
      props.details.staticMethods,
      pins(),
      methodInfoId,
    ),
  );

  return (
    <>
      <GroupedMembersList
        {...props}
        fieldLists={fieldLists()}
        propertyLists={propertyLists()}
        methodLists={methodLists()}
      />
      <Show when={props.details.parent}>
        <PinsList {...props} details={props.details.parent!} />
      </Show>
    </>
  );
}

function DetailsList(props: {
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
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
  header?: boolean;
}) {
  const visibility = () =>
    props.selection.data
      ? props.visibility
      : ("Static Members Only" satisfies VisibilityMode);

  const fieldLists = createMemo(() =>
    filterMembers(
      props.details.fields,
      props.details.staticFields,
      props.search,
      props.searchMode,
      props.filters,
      visibility(),
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
      visibility(),
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
      visibility(),
      props.sort,
      props.inverse,
    ),
  );

  return (
    <>
      <GroupedMembersList
        {...props}
        fieldLists={fieldLists()}
        propertyLists={propertyLists()}
        methodLists={methodLists()}
        header={protoClassToString(props.details.clazz!)}
        staticsHeader
      />
      <Show when={props.details.parent}>
        <DetailsList {...props} details={props.details.parent!} header={true} />
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
  const [type, setType] = createSignal<ProtoTypeInfo>();
  const [addressInput, setAddressInput] = createSignal("");

  const api = useDockview();

  const validClass = () => type()?.Info?.$case == "classInfo";

  const selectClass = () =>
    validClass() &&
    selectInLastPanel(api, {
      data: undefined,
      typeInfo: type(),
    });

  const validAddress = () => !!addressInput().match(/^0x[0-9a-f]+|[0-9]+$/);

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
    <div class="center-child">
      <div class="floating-menu flex flex-col gap-2 p-2">
        No Selection
        <div class="join">
          <TypeCell
            class={`input-lg join-item ${validClass() ? "" : "input-error"}`}
            placeholder="Select Class"
            title="Select Class"
            value={type()}
            onChange={setType}
          />
          <button
            class="btn btn-lg btn-square join-item"
            disabled={!validClass()}
            onClick={selectClass}
          >
            <Icon path={chevronDoubleRight} />
          </button>
        </div>
        <div class="join">
          <input
            class={`input input-lg join-item ${validAddress() ? "" : "input-error"}`}
            placeholder="Select Address"
            title="Select Address"
            use:valueSignal={[addressInput, setAddressInput]}
            use:onEnter={() => selectAddress()}
          />
          <button
            class="btn btn-lg btn-square join-item"
            disabled={!validAddress()}
            onClick={selectAddress}
          >
            <Icon path={chevronDoubleRight} />
          </button>
        </div>
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

  const selection = () => getSelection(id);

  // synchronize changes to everything determined by the selection
  const [sync, loading] = createAsyncMemo(async () => {
    const sel = selection();

    let details: ProtoClassDetails | undefined;

    let classInfo: ProtoClassInfo | undefined = undefined;
    if (sel?.typeInfo?.Info?.$case == "classInfo")
      classInfo = sel?.typeInfo.Info.classInfo;
    else if (sel?.typeInfo?.Info?.$case == "structInfo")
      classInfo = sel?.typeInfo.Info.structInfo.clazz;
    if (classInfo) details = await getClassDetails(classInfo);

    const [values, setValues] = createStore<ValuesStore>({});

    if (sel?.data) {
      const result = await sendPacketResult<GetInstanceValuesResult>({
        getInstanceValues: { instance: sel },
      })[0];
      setValues(
        reconcile(
          Object.fromEntries(
            result.values.map(({ id, data }) => [bigToString(id), data]),
          ),
        ),
      );
    }

    const [methodsStore, setMethodsStore] = createStore<MethodsStore>({});

    return {
      details,
      values,
      setValues,
      methodsStore,
      setMethodsStore,
    };
  });

  createEffect(() =>
    setTitle(
      selection()?.typeInfo
        ? protoTypeToString(selection()!.typeInfo!)
        : "No Selection",
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
    <Show when={selection()} fallback={<NoSelection />}>
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
              text={protoTypeToString(selection()!.typeInfo!)}
              textFirst
              icon={ellipsisHorizontalCircle}
              disabled={loading()}
              dropdownClass="mono p-2 gap-2 max-w-2xl max-h-96 overflow-auto"
            >
              <InheritancePanel details={sync()?.details} />
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
              disabled={!selection()?.data}
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
          when={!loading() && sync()?.details}
          fallback={
            <div class="center-child">
              <span class="loading loading-xl m-2" />
            </div>
          }
        >
          <div class="grow gutter overflow-auto flex flex-col pr-1.5 gap-2">
            <PinsList
              selection={selection()!}
              updateSelection={(data) => updateSelection(id, data)}
              details={sync()!.details!}
              values={sync()!.values}
              setValues={sync()!.setValues}
              methodsStore={sync()!.methodsStore}
              setMethodsStore={sync()!.setMethodsStore}
            />
            <DetailsList
              selection={selection()!}
              updateSelection={(data) => updateSelection(id, data)}
              details={sync()!.details!}
              values={sync()!.values}
              setValues={sync()!.setValues}
              methodsStore={sync()!.methodsStore}
              setMethodsStore={sync()!.setMethodsStore}
              search={search()}
              searchMode={searchMode()}
              filters={filters}
              visibility={visibility()}
              sort={sorting()}
              inverse={inverse()}
              header={hasPins(sync()!.details)}
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
