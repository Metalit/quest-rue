import { Icon } from "solid-heroicons";
import { plus, xMark } from "solid-heroicons/outline";
import {
  batch,
  createRenderEffect,
  createSignal,
  For,
  JSX,
  Show,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import { getClassDetails } from "../global/cache";
import { ScopedVariable } from "../global/variables";
import {
  ProtoClassInfo,
  ProtoDataSegment,
  ProtoTypeInfo,
} from "../proto/il2cpp";
import { setDataCase } from "../types/serialization";
import { createAsyncMemo } from "../utils/solid";
import { extractCase } from "../utils/typing";
import { ConstructorCell } from "./data/MethodCell";
import { ValueCell } from "./data/ValueCell";

export interface CreationProps {
  typeInfo: ProtoTypeInfo;
  variable: ScopedVariable;
  cancel: () => void;
  confirm: () => void;
}

function ArrayCreation(props: CreationProps) {
  console.log("render array creation");
  // do weird object wrapper to make adding undefined elements possible
  const [items, setItems] = createStore<
    { value: ProtoDataSegment | undefined }[]
  >([]);

  const valid = () => items.every(({ value }) => value != undefined);

  const save = () =>
    valid() &&
    props.variable.set(
      setDataCase({
        arrayData: {
          data: items.map(({ value }) => value!),
        },
      }),
    );

  const itemType = () =>
    extractCase(props.typeInfo.Info, "arrayInfo")!.memberType!;

  const [slotIndex, setSlotIndex] = createSignal(0);
  const [slot, setSlot] = createSignal<JSX.Element>();

  return (
    <div class="flex flex-col gap-1">
      <For each={items}>
        {(item, i) => (
          <>
            <div class="join">
              <ValueCell
                class="join-item"
                typeInfo={itemType()}
                title={i().toString()}
                value={item.value}
                onChange={(value) => setItems(i(), "value", value)}
                setSlot={(element) =>
                  batch(() => {
                    setSlot(element);
                    setSlotIndex(i());
                  })
                }
              />
              <button
                class="join-item btn btn-square"
                title="Remove"
                onClick={() =>
                  setItems(produce((elements) => elements.splice(i(), 1)))
                }
              >
                <Icon path={xMark} />
              </button>
            </div>
            <Show when={slot() && i() == slotIndex()}>
              <div class="floating-menu p-1">{slot()}</div>
            </Show>
          </>
        )}
      </For>
      <div class="mt-1 flex gap-1 justify-end">
        <button
          class="btn btn-square"
          title="Add element"
          onClick={() => setItems(items.length, { value: undefined })}
        >
          <Icon path={plus} />
        </button>
        <button
          class="btn"
          onClick={() => {
            save();
            props.confirm();
          }}
          disabled={!valid()}
        >
          Create
        </button>
        <button
          class="btn btn-square"
          title="Cancel"
          onClick={() => props.cancel()}
        >
          <Icon path={xMark} />
        </button>
      </div>
    </div>
  );
}

function ObjectCreation(props: CreationProps) {
  const [methods, methodsLoading] = createAsyncMemo(async () => {
    let classInfo: ProtoClassInfo | undefined = undefined;
    if (props.typeInfo.Info?.$case == "classInfo")
      classInfo = props.typeInfo.Info.classInfo;
    else if (props.typeInfo.Info?.$case == "structInfo")
      classInfo = props.typeInfo.Info.structInfo.clazz;
    if (classInfo) {
      const details = await getClassDetails(classInfo);
      return (details?.methods ?? [])
        .filter(({ name }) => name == ".ctor")
        .sort((m1, m2) => m1.args.length - m2.args.length);
    }
    return [];
  });

  createRenderEffect(() => props.variable.make());

  const loading = () => methodsLoading() || props.variable.loading();

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="center-child">
          <span class="loading loading-sm m-2" />
        </div>
      }
    >
      <div class="flex flex-col gap-2 pl-1">
        <For each={methods()}>
          {(method) => (
            <ConstructorCell
              method={method}
              typeInfo={props.typeInfo}
              variable={props.variable}
              onRun={() => props.confirm()}
            />
          )}
        </For>
        <div class="flex gap-1 justify-end">
          <button class="btn btn-ghost" onClick={() => props.confirm()}>
            Create without constructor
          </button>
          <button
            class="btn btn-square"
            title="Cancel"
            onClick={() => props.cancel()}
          >
            <Icon path={xMark} />
          </button>
        </div>
      </div>
    </Show>
  );
}

export function Creation(props: CreationProps) {
  return (
    <Show
      when={props.typeInfo.Info?.$case != "arrayInfo"}
      fallback={<ArrayCreation {...props} />}
    >
      <ObjectCreation {...props} />
    </Show>
  );
}
