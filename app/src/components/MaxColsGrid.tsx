import { JSX, splitProps } from "solid-js";

export function MaxColsGrid(
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    colGap?: number;
    maxCols?: number;
    minWidth?: number;
  },
) {
  const [modified, normal] = splitProps(props, [
    "class",
    "colGap",
    "maxCols",
    "minWidth",
  ]);

  return (
    <div
      {...normal}
      class={`max-cols-grid ${modified.class ?? ""}`}
      style={{
        "--grid-column-gap": modified.colGap,
        "--grid-column-count": modified.maxCols,
        "--grid-item-min-width": modified.minWidth,
      }}
    />
  );
}
