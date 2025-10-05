import { Icon } from "solid-heroicons";
import { Show } from "solid-js";
import { errorHandle } from "../../utils/misc";
import { IconPath } from "../../utils/typing";

interface ActionButtonProps {
  img: IconPath | "save";
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
      onClick={() => errorHandle(props.onClick ?? (() => {}))}
      onKeyPress={() => errorHandle(props.onClick ?? (() => {}))}
      title={props.tooltip}
    >
      <Show when={props.loading} fallback={icon()}>
        <span class="loading" />
      </Show>
    </button>
  );
}
