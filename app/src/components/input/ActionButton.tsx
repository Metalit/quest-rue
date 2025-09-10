import { Icon } from "solid-heroicons";
import { JSX, Show } from "solid-js";

import { errorHandle } from "../../global/utils";

interface ActionButtonProps {
  img:
    | { path: JSX.Element; outline: boolean; mini: boolean }
    | "enter"
    | "save"
    | "refresh";
  onClick?: () => void;
  loading?: boolean;
  class?: string;
  label?: string;
  tooltip?: string;
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
      // Accessibility is important
      aria-label={props.label ?? props.tooltip}
      class={props.class}
      classList={{ tooltip: props.tooltip !== undefined }}
      // False positive
      // eslint-disable-next-line solid/reactivity
      onClick={() => errorHandle(() => props.onClick?.())}
      // eslint-disable-next-line solid/reactivity
      onKeyPress={() => errorHandle(() => props.onClick?.())}
      title={props.tooltip}
    >
      <Show when={props.loading} fallback={icon()}>
        <img
          src="/loading.svg"
          class="animate-spin light-invert"
          elementtiming={"Loading"}
          fetchpriority={"auto"}
          alt="Loading"
        />
      </Show>
    </button>
  );
}
