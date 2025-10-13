import {
  arrowLeftOnRectangle,
  check,
  chevronDown,
  chevronLeft,
} from "solid-heroicons/outline";
import {
  batch,
  createEffect,
  createRenderEffect,
  createSignal,
  For,
  JSX,
  Show,
  untrack,
} from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import { ScopedVariable } from "../../global/variables";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoMethodInfo,
  ProtoTypeInfo,
  ProtoTypeInfo_Byref,
} from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { protoTypeToString } from "../../types/format";
import {
  GenericsMap,
  getArgGenericsMap,
  getNewInstantiationData,
} from "../../types/generics";
import {
  defaultDataSegment,
  stringToDataSegment,
} from "../../types/serialization";
import { ActionButton } from "../input/ActionButton";
import { MaxColsGrid } from "../MaxColsGrid";
import { TypeCell } from "./TypeCell";
import { ValueCell } from "./ValueCell";

export interface MethodCellState {
  ret?: ProtoDataPayload;
  generics?: GenericsMap;
  args?: ProtoDataPayload[];
}

interface MethodCellProps {
  method: ProtoMethodInfo;
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  state: MethodCellState;
  setState: SetStoreFunction<MethodCellState>;
}

function hasArgs(state: MethodCellState) {
  return (state.args?.length ?? 0) > 0;
}

function hasGenerics(state: MethodCellState) {
  return Object.values(state.generics ?? {}).length > 0;
}

function getRunner(
  method: () => ProtoMethodInfo,
  selection: () => ProtoDataPayload,
  updateSelection: (data: ProtoDataSegment) => void,
  state: () => MethodCellState,
  setState: () => SetStoreFunction<MethodCellState>,
  onRun?: () => void,
) {
  const [result, loading, sendRun] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (result?: InvokeMethodResult) =>
    result?.error &&
    toast.error(`Error running ${method().name}: ${result.error}`);

  createEffect(() => {
    const res = result();
    showError(res);
    if (res)
      untrack(() => {
        batch(() => {
          setState()("ret", res.result);
          Object.entries(res.byrefChanges).forEach(([arg, { data }]) =>
            setState()("args", Number(arg), "data", data),
          );
          if (res.self) updateSelection(res.self!);
        });
        onRun?.();
      });
  });

  // this should probably be done on the server side, but it's here for now
  const argsWithFilledRefs = () =>
    state().args?.map(({ data, typeInfo }) => ({
      typeInfo,
      data:
        data ??
        (typeInfo?.byref == ProtoTypeInfo_Byref.OUT
          ? defaultDataSegment(typeInfo)
          : undefined),
    }));

  const genericList = () => Object.values(state().generics ?? {});

  const canRun = () =>
    genericList().every(({ value }) => value) &&
    !!argsWithFilledRefs()?.every(({ data }) => data);

  const run = () =>
    canRun() &&
    sendRun({
      invokeMethod: {
        methodId: method().id,
        inst: selection(),
        args: argsWithFilledRefs()!,
        generics: genericList().map(({ value }) => value!),
      },
    });

  return [run, loading, canRun] as const;
}

function MethodCellArguments(props: {
  method: ProtoMethodInfo;
  state: MethodCellState;
  setState: SetStoreFunction<MethodCellState>;
}) {
  createRenderEffect(
    () =>
      !props.state.args &&
      props.setState({
        generics: getArgGenericsMap(props.method),
        args: props.method.args.map(({ type }) => ({
          data: type && stringToDataSegment("", type),
          typeInfo: type,
        })),
        ret: {
          data: undefined,
          typeInfo: props.method.returnType,
        },
      }),
  );

  // update types with generic instantiations, clearing data if changed
  createEffect(() => {
    if (!hasGenerics(props.state)) return;
    for (let i = 0; i < (props.state!.args?.length ?? 0); i++) {
      const [data, isNew] = getNewInstantiationData(
        props.state!.args![i],
        props.method.args[i].type!,
        props.state!.generics!,
      );
      if (isNew) props.setState("args", i, data);
    }
    const [data, isNew] = getNewInstantiationData(
      props.state!.ret,
      props.method.returnType!,
      props.state!.generics!,
    );
    if (isNew) props.setState("ret", data);
  });

  const [slotIndex, setSlotIndex] = createSignal(0);
  const [slot, setSlot] = createSignal<JSX.Element>();

  return (
    <div class="py-1 flex flex-col">
      <Show when={hasGenerics(props.state)}>
        <MaxColsGrid
          colGap={8}
          maxCols={5}
          minWidth={280}
          class="w-full gap-y-2"
        >
          <For each={Object.entries(props.state?.generics ?? {})}>
            {([key, { generic, value }]) => (
              <TypeCell
                value={value}
                onChange={(value) =>
                  props.setState("generics", key, "value", value)
                }
                placeholder={protoTypeToString(generic)}
                title={protoTypeToString(generic)}
              />
            )}
          </For>
        </MaxColsGrid>
      </Show>
      <Show when={hasGenerics(props.state) && hasArgs(props.state)}>
        <div class="divider" />
      </Show>
      <Show when={hasArgs(props.state)}>
        <MaxColsGrid
          colGap={8}
          maxCols={5}
          minWidth={280}
          class="w-full gap-y-2"
        >
          <For each={props.state!.args!}>
            {(arg, i) => (
              <>
                <ValueCell
                  class="mono"
                  typeInfo={arg.typeInfo!}
                  value={arg.data}
                  onChange={(value) =>
                    props.setState("args", i(), "data", value)
                  }
                  placeholder={props.method.args[i()].name}
                  readonly={arg.typeInfo?.byref == ProtoTypeInfo_Byref.OUT}
                  setSlot={(element) =>
                    batch(() => {
                      setSlot(element);
                      setSlotIndex(i());
                    })
                  }
                />
                <Show when={slot() && i() == slotIndex()}>
                  <div class="-mt-1 floating-menu p-1 col-span-full">
                    {slot()}
                  </div>
                </Show>
              </>
            )}
          </For>
        </MaxColsGrid>
      </Show>
    </div>
  );
}

export function MethodCell(props: MethodCellProps) {
  const [run, loading, canRun] = getRunner(
    () => props.method,
    () => props.selection,
    (data) => props.updateSelection(data),
    () => props.state,
    () => props.setState,
  );

  const [slot, setSlot] = createSignal<JSX.Element>();

  const [expanded, setExpanded] = createSignal(false);

  const args = (
    <MethodCellArguments
      method={props.method}
      state={props.state}
      setState={props.setState}
    />
  );

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center">
        <span
          class="mono grow min-w-0 whitespace-nowrap text-ellipsis"
          title={props.method.name}
        >
          {props.method.name}
        </span>
        <div class="join w-3/5 shrink-0 justify-end">
          <ValueCell
            class="join-item mono"
            readonly
            typeInfo={props.state?.ret?.typeInfo ?? props.method.returnType!}
            value={props.state?.ret?.data}
            setSlot={setSlot}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={arrowLeftOnRectangle}
            tooltip="Run method"
            loading={loading()}
            onClick={run}
            disabled={!canRun()}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={expanded() ? chevronDown : chevronLeft}
            tooltip="Show parameters"
            onClick={() => setExpanded((val) => !val)}
            disabled={!hasArgs(props.state) && !hasGenerics(props.state)}
          />
        </div>
      </div>
      <Show when={slot()}>
        <div class="floating-menu p-1">{slot()}</div>
      </Show>
      <Show when={expanded()}>{args}</Show>
    </div>
  );
}

interface ConstructorCellProps {
  method: ProtoMethodInfo;
  typeInfo: ProtoTypeInfo;
  variable: ScopedVariable;
  onRun?: () => void;
}

export function ConstructorCell(props: ConstructorCellProps) {
  const [state, setState] = createStore<MethodCellState>();

  const [run, loading, canRun] = getRunner(
    () => props.method,
    () => ({ typeInfo: props.typeInfo, data: props.variable.get() }),
    (data) => props.variable.set(data),
    () => state,
    () => setState,
    () => props.onRun?.(),
  );

  const [expanded, setExpanded] = createSignal(false);

  const name = () =>
    `${props.method.args.length}: ${props.method.args.map(({ name }) => name).join(", ")}`;

  const args = (
    <MethodCellArguments
      method={props.method}
      state={state}
      setState={setState}
    />
  );

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-center">
        <span
          class="mono grow min-w-0 whitespace-nowrap text-ellipsis"
          title={name()}
        >
          {name()}
        </span>
        <div class="join">
          <ActionButton
            class="join-item btn btn-square"
            img={check}
            tooltip="Run constructor"
            loading={loading()}
            onClick={run}
            disabled={!canRun()}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={expanded() ? chevronDown : chevronLeft}
            tooltip="Show parameters"
            onClick={() => setExpanded((val) => !val)}
            disabled={!hasArgs(state) && !hasGenerics(state)}
          />
        </div>
      </div>
      <Show when={expanded()}>{args}</Show>
    </div>
  );
}
