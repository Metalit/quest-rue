import { For, JSX, splitProps } from "solid-js";

interface SegmentedControlProps<T>
  extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, "onChange"> {
  value: T;
  values: T[];
  onChange: (s: T) => void;
  display?: (value: T) => string;

  disabled?: boolean;
}

export default function SegmentedControl<T>(props: SegmentedControlProps<T>) {
  const [custom, normal] = splitProps(props, [
    "value",
    "values",
    "onChange",
    "display",
    "disabled",
  ]);

  const display = (value: T) => custom.display?.(value) ?? `${value}`;

  return (
    <span {...normal} class={`flex items-center gap-2.5 ${normal.class}`}>
      <label class="label">{normal.title}</label>
      <div class="join">
        <For each={custom.values}>
          {(item) => (
            <label class="join-item btn btn-square has-checked:btn-accent">
              <input
                type="radio"
                class="hidden"
                checked={item == custom.value}
                use:onCheck={(value) => value && custom.onChange(item)}
              />
              {display(item)}
            </label>
          )}
        </For>
      </div>
    </span>
  );
}
