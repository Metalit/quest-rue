import {
  arrowLeftOnRectangle,
  chevronDown,
  chevronLeft,
} from "solid-heroicons/outline";
import {
  batch,
  createEffect,
  createRenderEffect,
  createSignal,
  For,
  Show,
} from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoMethodInfo,
  ProtoTypeInfo_Byref,
} from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { protoTypeToString } from "../../types/format";
import {
  GenericsMap,
  getArgGenericsMap,
  getNewInstantiationData,
} from "../../types/generics";
import { defaultDataSegment } from "../../types/serialization";
import { ActionButton } from "../input/ActionButton";
import { MaxColsGrid } from "../MaxColsGrid";
import { TypeCell } from "./TypeCell";
import { ValueCell } from "./ValueCell";

export interface MethodCellMemory {
  ret?: ProtoDataPayload;
  generics?: GenericsMap;
  args?: ProtoDataPayload[];
}

interface MethodCellProps {
  method: ProtoMethodInfo;
  selection: ProtoDataPayload;
  updateSelection: (data: ProtoDataSegment) => void;
  memory?: MethodCellMemory;
  setMemory: SetStoreFunction<MethodCellMemory>;
  expanded?: boolean;
}

export function MethodCell(props: MethodCellProps) {
  const [result, resultLoading, updateResult] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (result?: InvokeMethodResult) =>
    result?.error &&
    toast.error(`Error running ${props.method.name}: ${result.error}`);
  createEffect(() => {
    const res = result();
    showError(res);
    if (res)
      batch(() => {
        props.setMemory("ret", result()?.result);
        Object.entries(res.byrefChanges).forEach(([arg, { data }]) =>
          props.setMemory("args", Number(arg), "data", data),
        );
        if (result()?.self)
          if (result()?.self) props.updateSelection(result()!.self!);
      });
  });

  createRenderEffect(
    () =>
      !props.memory &&
      props.setMemory({
        generics: getArgGenericsMap(props.method),
        args: props.method.args.map(({ type }) => ({
          data: undefined,
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
    if (!hasGenerics()) return;
    for (let i = 0; i < (props.memory!.args?.length ?? 0); i++) {
      const [data, isNew] = getNewInstantiationData(
        props.memory!.args![i],
        props.method.args[i].type!,
        props.memory!.generics!,
      );
      if (isNew) props.setMemory("args", i, data);
    }
    const [data, isNew] = getNewInstantiationData(
      props.memory!.ret,
      props.method.returnType!,
      props.memory!.generics!,
    );
    if (isNew) props.setMemory("ret", data);
  });

  const genericList = () => Object.values(props.memory?.generics ?? {});
  const hasGenerics = () => genericList().length > 0;

  // this should probably be done on the server side, but it's here for now
  const argsWithFilledRefs = () =>
    props.memory?.args?.map(({ data, typeInfo }) => ({
      typeInfo,
      data:
        data ??
        (typeInfo?.byref == ProtoTypeInfo_Byref.OUT
          ? defaultDataSegment(typeInfo)
          : undefined),
    }));

  const run = () =>
    genericList().every(({ value }) => value) &&
    argsWithFilledRefs()?.every(({ data }) => data) &&
    updateResult({
      invokeMethod: {
        methodId: props.method.id,
        inst: props.selection,
        args: argsWithFilledRefs()!,
        generics: genericList().map(({ value }) => value!),
      },
    });

  const [userExpanded, setUserExpanded] = createSignal(false);
  const expanded = () => props.expanded || userExpanded();

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="mono grow min-w-0" title={props.method.name}>
          {props.method.name}
        </span>
        <div class="join w-3/5 shrink-0 justify-end">
          <ValueCell
            class="join-item mono"
            readonly
            typeInfo={props.memory?.ret?.typeInfo ?? props.method.returnType!}
            value={props.memory?.ret?.data}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={arrowLeftOnRectangle}
            tooltip="Run Method"
            loading={resultLoading()}
            onClick={run}
          />
          <ActionButton
            class="join-item btn btn-square"
            img={expanded() ? chevronDown : chevronLeft}
            tooltip="Show Parameters"
            onClick={() => setUserExpanded((val) => !val)}
            disabled={
              (props.method.args.length == 0 && !hasGenerics()) ||
              props.expanded
            }
          />
        </div>
      </div>
      <Show when={expanded()}>
        <Show when={hasGenerics()}>
          <MaxColsGrid
            colGap={8}
            maxCols={5}
            minWidth={280}
            class="w-full gap-y-2 mb-1"
          >
            <For each={Object.entries(props.memory?.generics ?? {})}>
              {([key, { generic, value }]) => (
                <TypeCell
                  value={value}
                  onChange={(value) =>
                    props.setMemory("generics", key, "value", value)
                  }
                  placeholder={protoTypeToString(generic)}
                  title={protoTypeToString(generic)}
                />
              )}
            </For>
          </MaxColsGrid>
        </Show>
        <Show when={(props.memory?.args?.length ?? 0) > 0}>
          <MaxColsGrid
            colGap={8}
            maxCols={5}
            minWidth={280}
            class="w-full gap-y-2 mb-1"
          >
            <For each={props.memory!.args!}>
              {(arg, i) => (
                <ValueCell
                  class="mono"
                  typeInfo={arg.typeInfo!}
                  value={arg.data}
                  onChange={(value) =>
                    props.setMemory("args", i(), "data", value)
                  }
                  placeholder={props.method.args[i()].name}
                  readonly={arg.typeInfo?.byref == ProtoTypeInfo_Byref.OUT}
                />
              )}
            </For>
          </MaxColsGrid>
        </Show>
      </Show>
    </div>
  );
}
