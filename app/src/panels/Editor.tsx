import { Icon } from "solid-heroicons";
import { check } from "solid-heroicons/outline";
import { createEffect, createSignal, Show } from "solid-js";

import { SelectInput } from "../components/input/SelectInput";
import { DataEditor } from "../components/Monaco";
import { useDockviewPanel } from "../dockview/Api";
import { getVariable, updateVariable, variables } from "../global/variables";

export function Editor() {
  const { setTitle, data } = useDockviewPanel<number>();

  const [editing, setEditing] = createSignal(!!data);
  const [id, setVariableId] = createSignal(data);

  const variable = () => getVariable(id());

  createEffect(() =>
    setTitle(
      variable() && editing() ? `Editing: ${variable()!.name}` : "Editor",
    ),
  );

  createEffect(() => !variable() && setEditing(false));

  const notEditing = (
    <div class="center-child">
      <div class="floating-menu p-2">
        <div class="join">
          <SelectInput
            class="join-item input input-lg"
            placeholder="Select variable"
            title="Select variable"
            value={variable()}
            options={variables}
            onChange={(variable) => setVariableId(variable?.id)}
            search={(input, { name }) =>
              name.toLocaleLowerCase().includes(input.toLocaleLowerCase())
            }
            display={(variable) => variable?.name ?? ""}
            disabled={variables.length == 0}
          />
          <button
            class="join-item btn btn-lg btn-square"
            onClick={() => setEditing(true)}
            disabled={!id()}
          >
            <Icon path={check} />
          </button>
        </div>
      </div>
    </div>
  );

  const typeInfo = () => variable()?.value.typeInfo;

  return (
    <Show when={editing() && variable()} fallback={notEditing}>
      <div class="p-2 pt-2.5 size-full flex flex-col">
        <DataEditor
          class="grow min-h-0 -m-1 p-1 rounded bg-base-50"
          typeInfo={typeInfo()!}
          value={variable()!.value.data}
          onChange={(data) => updateVariable(variable()!.name, data)}
        />
      </div>
    </Show>
  );
}
