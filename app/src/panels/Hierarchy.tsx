import { Icon } from "solid-heroicons";
import {
  barsArrowDown,
  barsArrowUp,
  chevronDown,
  chevronRight,
  eye,
  viewfinderCircle,
} from "solid-heroicons/outline";
import { createMemo, createSignal, Show } from "solid-js";
import {
  createStore,
  reconcile,
  SetStoreFunction,
  unwrap,
} from "solid-js/store";

import { useDockview } from "../components/Dockview";
import {
  DropdownButton,
  ModeOptions,
} from "../components/input/DropdownButton";
import { SelectInput } from "../components/input/SelectInput";
import { VirtualList } from "../components/VirtualList";
import { gameObjectsStore } from "../global/hierarchy";
import { selectInLastPanel } from "../global/selection";
import { ProtoScene } from "../proto/unity";
import { setDataCase, typeForClass } from "../types/serialization";

const sortModes = [
  "Name",
  "Sibling Index",
  "Children Count",
  "Instance ID",
  "Layer",
] as const;

type SortMode = (typeof sortModes)[number];

const visibilityModes = [
  "Show Inactive",
  "Inactive Last",
  "Hide Inactive",
] as const;

type VisibilityMode = (typeof visibilityModes)[number];

type Hierarchy = { address: string; children: Hierarchy }[];

type DisplayInfo = {
  [address: string]: {
    indent: number;
    children: number;
    match: boolean;
    expanded: boolean;
  };
};

function getSortingField(address: string, mode: SortMode) {
  const object = gameObjectsStore.objects[address];
  if (!object) return 0;
  switch (mode) {
    case "Name":
      return object.name;
    case "Sibling Index":
      return object.transform?.siblingIdx ?? 0;
    case "Children Count":
      return object.transform?.childCount ?? 0;
    case "Instance ID":
      return object.instanceId;
    case "Layer":
      return object.layer;
  }
}

function getActiveSort(address1: string, address2: string) {
  const active1 = gameObjectsStore.objects[address1].active;
  const active2 = gameObjectsStore.objects[address2].active;
  if (active1 == active2) return 0;
  return active1 ? -1 : 1;
}

function compareObjects(
  address1: string,
  address2: string,
  mode: SortMode,
  inverse: boolean,
  inactiveLast: boolean,
  fallback: SortMode,
) {
  if (inactiveLast) {
    const activeSort = getActiveSort(address1, address2);
    if (activeSort != 0) return activeSort;
  }
  const key1 = getSortingField(address1, mode);
  const key2 = getSortingField(address2, mode);
  let ret = 0;
  if (typeof key1 == "number") ret = key1 - (key2 as number);
  else if (typeof key1 == "string") ret = key1.localeCompare(key2 as string);
  if (ret == 0 && mode != fallback)
    return compareObjects(
      address1,
      address2,
      fallback,
      inverse,
      inactiveLast,
      fallback,
    );
  return inverse ? ret * -1 : ret;
}

function sortedAddresses(
  addresses: string[],
  mode: SortMode,
  inverse: boolean,
  visibility: VisibilityMode,
  fallback: SortMode = "Sibling Index",
) {
  const inactiveLast = visibility == "Inactive Last";
  return [...addresses].sort((a1, a2) =>
    compareObjects(a1, a2, mode, inverse, inactiveLast, fallback),
  );
}

function addAddress(
  address: string,
  list: Hierarchy,
  info: DisplayInfo,
  prevInfo: DisplayInfo,
  search: string[],
  scene: number | undefined,
  visibility: VisibilityMode,
  sorting: SortMode,
  inverse: boolean,
  indent = 0,
  searchMatched = 0,
  parentMatch = false,
): boolean {
  const object = gameObjectsStore.objects[address];
  if (visibility == "Hide Inactive" && !object.active) return false;
  if (scene && object.scene != scene) return false;
  if (object.name.toLocaleLowerCase().includes(search[searchMatched]))
    searchMatched++;
  const selfMatch = searchMatched >= search.length;
  if (selfMatch) searchMatched = 0;
  const children: Hierarchy = [];
  const childMatch = sortedAddresses(
    gameObjectsStore.children[address] ?? [],
    sorting,
    inverse,
    visibility,
  ).reduce(
    (anyMatch, child) =>
      addAddress(
        child,
        children,
        info,
        prevInfo,
        search,
        scene,
        visibility,
        sorting,
        inverse,
        indent + 1,
        searchMatched,
        parentMatch || selfMatch,
      ) || anyMatch,
    false,
  );
  if (selfMatch || parentMatch || childMatch) {
    list.push({ address, children });
    const expanded =
      search.length > 0 ? childMatch : (prevInfo[address]?.expanded ?? true);
    info[address] = {
      indent,
      expanded,
      match: search.length > 0 && selfMatch,
      children: children.length,
    };
  }
  return selfMatch || childMatch;
}

function computeHierarchy(
  search: string,
  scene: number | undefined,
  visibility: VisibilityMode,
  sorting: SortMode,
  inverse: boolean,
  prevInfo: DisplayInfo,
) {
  const list: Hierarchy = [];
  const info: DisplayInfo = {};
  const splitSearch = search
    .toLocaleLowerCase()
    .split("/")
    .filter((part) => part != "");
  for (const address of sortedAddresses(
    gameObjectsStore.roots,
    sorting,
    inverse,
    visibility,
    "Name",
  ))
    addAddress(
      address,
      list,
      info,
      prevInfo,
      splitSearch,
      scene,
      visibility,
      sorting,
      inverse,
    );
  return [list, info] as const;
}

function expandHierarchy(hierarchy: Hierarchy, info: DisplayInfo): string[] {
  return hierarchy.flatMap(({ address, children }) =>
    info[address].expanded
      ? [address, ...expandHierarchy(children, info)]
      : address,
  );
}

function ObjectListItem(props: {
  address: string;
  info: DisplayInfo;
  setInfo: SetStoreFunction<DisplayInfo>;
}) {
  const object = () => gameObjectsStore.objects[props.address];
  const info = () => props.info[props.address];

  const toggleExpand = () =>
    props.setInfo(props.address, "expanded", (val) => !val);

  const api = useDockview();

  const select = () => {
    const typeInfo = typeForClass("UnityEngine", "GameObject");
    const data = setDataCase({ classData: object().address });
    selectInLastPanel(api, { typeInfo, data });
  };

  return (
    <div
      class="h-5 flex items-center gap-0.5"
      style={{
        "padding-left": info().indent * 15 + "px",
        "text-decoration-line": info().match ? "underline" : undefined,
      }}
    >
      <Show when={info().children > 0}>
        <button
          class="btn btn-ghost size-5 p-1 ml-[-4px]"
          onClick={toggleExpand}
        >
          <Icon path={info().expanded ? chevronDown : chevronRight} />
        </button>
      </Show>
      <button
        class={object().active ? "" : "text-secondary-content"}
        onClick={select}
      >
        {object().name}
      </button>
    </div>
  );
}

function ObjectList(props: {
  search: string;
  scene?: number;
  visibility: VisibilityMode;
  sorting: SortMode;
  inverse: boolean;
}) {
  const [displayInfo, setDisplayInfo] = createStore<DisplayInfo>({});

  const hierarchy = createMemo(() => {
    const [list, info] = computeHierarchy(
      props.search,
      props.scene,
      props.visibility,
      props.sorting,
      props.inverse,
      unwrap(displayInfo),
    );
    setDisplayInfo(reconcile(info));
    return list;
  });
  const display = createMemo(() => expandHierarchy(hierarchy(), displayInfo));

  return (
    <VirtualList
      class="bg-base-100 rounded m-[-2px] p-1"
      items={display()}
      itemHeight={20}
      generator={(address) => (
        <ObjectListItem
          address={address}
          info={displayInfo}
          setInfo={setDisplayInfo}
        />
      )}
    />
  );
}

export function Hierarchy() {
  const allScene = ProtoScene.fromPartial({ name: "All", handle: undefined });

  const [search, setSearch] = createSignal("");
  const [scene, setScene] = createSignal<ProtoScene>(allScene);
  const [visibility, setVisibility] = createSignal<VisibilityMode>(
    visibilityModes[0],
  );
  const [sorting, setSorting] = createSignal<SortMode>(sortModes[0]);
  const [inverse, setInverse] = createSignal(false);

  const focusSeleced = () => {
    // not implemented
  };

  const scenes = () => [allScene, ...gameObjectsStore.scenes];

  const sceneName = (scene?: ProtoScene) =>
    scenes().find(({ handle }) => handle == scene?.handle)?.name ?? "All";

  return (
    <div class="p-2 pt-2.5 gap-1 flex flex-col items-stretch size-full">
      <input
        class="input input-sm shrink-0 w-full"
        placeholder="Search"
        use:valueSignal={[search, setSearch]}
      />
      <div class="flex gap-1">
        <SelectInput
          class="input input-sm"
          title="Scene"
          placeholder="Scene"
          options={scenes()}
          value={scene()}
          equals={(s1, s2) => s1?.handle == s2?.handle}
          display={sceneName}
          search={(input, { name }) =>
            name.toLocaleLowerCase().includes(input.toLocaleLowerCase())
          }
          onChange={setScene}
        />
        <button
          class="btn btn-sm btn-square"
          title="Focus Selected"
          onClick={focusSeleced}
        >
          <Icon path={viewfinderCircle} />
        </button>
        <DropdownButton
          class="btn-sm"
          title="Visibility"
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
      <div class="divider" />
      <ObjectList
        search={search()}
        scene={scene()?.handle}
        visibility={visibility()}
        sorting={sorting()}
        inverse={inverse()}
      />
    </div>
  );
}
