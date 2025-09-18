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
import { createStore } from "solid-js/store";
import toast from "solid-toast";

import { useRequestAndResponsePacket } from "../../global/packets";
import { ProtoDataPayload, ProtoMethodInfo } from "../../proto/il2cpp";
import { InvokeMethodResult } from "../../proto/qrue";
import { ActionButton } from "../input/ActionButton";
import { MaxColsGrid } from "../MaxColsGrid";
import { ValueCell } from "./ValueCell";

interface MethodCellProps {
  method: ProtoMethodInfo;
  selection: ProtoDataPayload;
  expanded?: boolean;
}

export function MethodCell(props: MethodCellProps) {
  const [result, resultLoading, updateResult] =
    useRequestAndResponsePacket<InvokeMethodResult>();

  const showError = (result?: InvokeMethodResult) =>
    result?.error &&
    toast.error(`Error running ${props.method.name}: ${result.error}`);
  createEffect(() => showError(result()));

  const run = () =>
    updateResult({
      invokeMethod: {
        methodId: props.method.id,
        inst: props.selection,
        args: args,
        generics: [],
      },
    });

  const [userExpanded, setUserExpanded] = createSignal(false);
  const expanded = () => props.expanded || userExpanded();

  const [args, setArgs] = createStore<ProtoDataPayload[]>([]);
  createRenderEffect(() =>
    setArgs(
      props.method.args.map(({ type }) => ({
        data: undefined,
        typeInfo: type,
      })),
    ),
  );

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="mono grow min-w-0" title={props.method.name}>
          {props.method.name}
        </span>
        <div class="join w-3/5 shrink-0 justify-end">
          <ValueCell
            class="join-item"
            disableInput
            typeInfo={props.method.returnType!}
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
            tooltip="Show Arguments"
            onClick={() => setUserExpanded((val) => !val)}
            disabled={props.method.args.length == 0 || props.expanded}
          />
        </div>
      </div>
      <Show when={expanded()}>
        <MaxColsGrid
          colGap={8}
          maxCols={4}
          minWidth={280}
          class="w-full gap-y-2"
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
    </div>
  );
}
