import { JSX, splitProps } from "solid-js";

interface ToggleProps
  extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, "onToggle"> {
  value: boolean;
  onToggle: (b: boolean) => void;
  disabled?: boolean;
  title?: string;
  id?: string;
}

export default function Toggle(props: ToggleProps) {
  const [overridden, kept] = splitProps(props, ["value", "onToggle", "class"]);

  return (
    <span {...kept} class={`flex items-center ${overridden.class ?? ""}`}>
      <label class="flex-1">{kept.title}</label>
      <input
        type="checkbox"
        class="toggle flex-none"
        id={kept.id}
        checked={overridden.value}
        onInput={(e) => overridden.onToggle(e.currentTarget.checked)}
      />
    </span>
  );
}
