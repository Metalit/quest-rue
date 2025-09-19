import {
  arrowLeftOnRectangle,
  chevronDown,
  chevronLeft,
} from "solid-heroicons/outline";
import {
  createEffect,
  createRenderEffect,
  createSignal,
  For,
  Show,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import { createUpdatingSignal } from "../../global/utils";
import {
  ProtoDataPayload,
  ProtoDataSegment,
  ProtoMethodInfo,
} from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { protoTypeToString } from "../../types/format";
import {
  GenericsMap,
  getArgGenericsMap,
  getInstantiation,
} from "../../types/generics";
import { areProtoTypesEqual } from "../../types/matching";
import { ActionButton } from "../input/ActionButton";
import { MaxColsGrid } from "../MaxColsGrid";
import { TypeCell } from "./TypeCell";
import { ValueCell } from "./ValueCell";

interface MethodCellProps {
  method: ProtoMethodInfo;
  selection: ProtoDataPayload;
  rememberedReturn?: ProtoDataSegment;
  setReturn: (value?: ProtoDataSegment) => void;
  expanded?: boolean;
}

export function MethodCell(props: MethodCellProps) {
  const [result, resultLoading, updateResult] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (result?: InvokeMethodResult) =>
    result?.error &&
    toast.error(`Error running ${props.method.name}: ${result.error}`);
  createEffect(() => {
    showError(result());
    result() && props.setReturn(result()?.result?.data);
  });

  const run = () =>
    Object.values(generics).every(({ value }) => value) &&
    updateResult({
      invokeMethod: {
        methodId: props.method.id,
        inst: props.selection,
        args: args,
        generics: Object.values(generics).map(({ value }) => value!),
      },
    });

  const [userExpanded, setUserExpanded] = createSignal(false);
  const expanded = () => props.expanded || userExpanded();

  const [args, setArgs] = createStore<ProtoDataPayload[]>([]);
  const [returnType, setReturn] = createUpdatingSignal(
    () => props.method.returnType!,
    { equals: areProtoTypesEqual },
  );

  createRenderEffect(() =>
    setArgs(
      props.method.args.map(({ type }) => ({
        data: undefined,
        typeInfo: type,
      })),
    ),
  );

  const [generics, setGenerics] = createStore<GenericsMap>({});
  const hasGenerics = () => Object.keys(generics).length > 0;

  createRenderEffect(() =>
    setGenerics(reconcile(getArgGenericsMap(props.method))),
  );

  createEffect(() => {
    setArgs((args) =>
      props.method.args.map((arg, i) => ({
        data: args[i].data,
        typeInfo: getInstantiation(arg.type!, generics),
      })),
    );
    setReturn(getInstantiation(props.method.returnType!, generics));
  });

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="mono grow min-w-0" title={props.method.name}>
          {props.method.name}
        </span>
        <div class="join w-3/5 shrink-0 justify-end">
          <ValueCell
            class="join-item"
            readonly
            typeInfo={returnType()}
            value={result()?.result?.data}
          />
          <ActionButton
            class="join-item btn btn-sm btn-square"
            img={arrowLeftOnRectangle}
            tooltip="Run Method"
            loading={resultLoading()}
            onClick={run}
          />
          <ActionButton
            class="join-item btn btn-sm btn-square"
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
            <For each={Object.entries(generics)}>
              {([key, { generic, value }]) => (
                <TypeCell
                  value={value}
                  onChange={(value) => setGenerics(key, "value", value)}
                  placeholder={protoTypeToString(generic)}
                  title={protoTypeToString(generic)}
                />
              )}
            </For>
          </MaxColsGrid>
        </Show>
        <Show when={args.length > 0}>
          <MaxColsGrid
            colGap={8}
            maxCols={5}
            minWidth={280}
            class="w-full gap-y-2 mb-1"
          >
            <For each={args}>
              {(arg, i) => (
                <ValueCell
                  typeInfo={arg.typeInfo!}
                  value={arg.data}
                  onChange={(value) => setArgs(i(), "data", value)}
                  placeholder={props.method.args[i()].name}
                />
              )}
            </For>
          </MaxColsGrid>
        </Show>
      </Show>
    </div>
  );
}
