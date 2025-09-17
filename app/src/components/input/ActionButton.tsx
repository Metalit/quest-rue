import { Icon } from "solid-heroicons";
import { Show } from "solid-js";

import { errorHandle, IconPath } from "../../global/utils";

interface ActionButtonProps {
  img: IconPath | "save" | "refresh";
  onClick?: () => void;
  loading?: boolean;
  class?: string;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
}

export function ActionButton(props: ActionButtonProps) {
  const icon = () =>
    typeof props.img == "string" ? (
      <img
        class="light-invert"
        src={`/${props.img}.svg`}
        elementtiming={"Action"}
        fetchpriority={"auto"}
        alt="Action"
      />
    ) : (
      <Icon path={props.img} />
    );

  return (
    <button
      class={props.class}
      disabled={props.disabled}
      classList={{ tooltip: props.tooltip !== undefined }}
      // False positive
      // eslint-disable-next-line solid/reactivity
      onClick={() => errorHandle(() => props.onClick?.())}
      // eslint-disable-next-line solid/reactivity
      onKeyPress={() => errorHandle(() => props.onClick?.())}
      title={props.tooltip}
    >
      <Show when={props.loading} fallback={icon()}>
        <span class="loading" />
      </Show>
    </button>
  );
}
